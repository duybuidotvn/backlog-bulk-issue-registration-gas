// https://developers.google.com/apps-script/reference/spreadsheet/

// ------------------------- 定数 -------------------------

/** データが記載されているシートの名前 */
var TEMPLATE_SHEET_NAME = "Template";

/** 行のデフォルト長 */
var DEFAULT_COLUMN_LENGTH = 16;

// ------------------------- 関数 -------------------------

/**
 * フック関数：スプレッドシート読み込み時に起動されます
 */
function onOpen() {
	SpreadsheetApp.getActiveSpreadsheet()
		.addMenu(
			"Backlog",
			[ 
				{ 
					name : BacklogScript.getMessage("menu_step1"), 
					functionName: "init"
				},
				{ 
					name : BacklogScript.getMessage("menu_step2"),
					functionName : "main"
				}
			]
		)
}

/**
 * Backlogのプロジェクト情報を取得し、定義シートに出力します
 */
function init() {
	BacklogScript.showInitDialog();
}

/**
 * スプレッドシートのデータを読み込んで、Backlogに課題を一括登録します
 */
function main() {
	BacklogScript.showRunDialog();
}

/**
 * '一括登録'ボタンをクリックすることで呼び出されます
 */
function main_run_() {
	var app = UiApp.getActiveApplication();
	var param = BacklogScript.getUserProperties();
	var keyLength = DEFAULT_COLUMN_LENGTH;
	var summaryLength = DEFAULT_COLUMN_LENGTH;
	var current = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
	var sheetName = BacklogScript.getMessage("scriptName") + " : " + current;
	var LOG_KEY_NUMBER = 1;
	var LOG_SUMMARY_NUMBER = 2;
	var onIssueCreated = function onIssueCreted(i, issue) {
		var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
		var issueKey = issue.issueKey;
		var summary = issue.summary;
		var fomula = '=hyperlink("' + param.space + ".backlog" + param.domain + "/" + "view/" + issueKey + '";"' + issueKey + '")';
		var currentRow = i + 1;

		if (logSheet == null)
			logSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(sheetName, 1);
		keyLength = Math.max(keyLength, strLength_(issueKey));
		summaryLength = Math.max(summaryLength, strLength_(summary));

		var keyWidth = calcWidth(keyLength);
		var summaryWidth = calcWidth(summaryLength);
		var keyCell = getCell(logSheet, LOG_KEY_NUMBER, currentRow);
		var summaryCell = getCell(logSheet, LOG_SUMMARY_NUMBER, currentRow);

		keyCell.setFormula(fomula).setFontColor("blue").setFontLine("underline");
		summaryCell.setValue(summary);
		setColumnWidth(logSheet, LOG_KEY_NUMBER, keyWidth);
		setColumnWidth(logSheet, LOG_SUMMARY_NUMBER, summaryWidth)
		SpreadsheetApp.flush();
	}
	var onWarn = function onWarn(message) {
		BacklogScript.showMessage(message);
	}

	// BacklogScript throws an exception on error
	BacklogScript.showMessage(BacklogScript.getMessage("progress_collect"));
	var templateIssues = getTemplateIssuesFromSpreadSheet_();
	BacklogScript.storeUserProperties(param)
	BacklogScript.showMessage(BacklogScript.getMessage("progress_begin"));
	BacklogScript.run(param.space, param.domain, param.apiKey, param.projectKey, templateIssues, onIssueCreated, onWarn);
	BacklogScript.showMessage(BacklogScript.getMessage("scriptName") + BacklogScript.getMessage("progress_end"));
	return app.close();
}

/**
 * Backlogプロジェクトの定義を取得します 
 */
function init_run_() {
	BacklogScript.getDefinitions();
}

/**
 * Templateシートからすべての項目を課題配列に格納します
 */
function getTemplateIssuesFromSpreadSheet_() {
	var issues = [];
    var spreadSheet = SpreadsheetApp.getActiveSpreadsheet();
	var sheet = spreadSheet.getSheetByName(TEMPLATE_SHEET_NAME);
	var COLUMN_START_INDEX = 1; /** データ列の開始インデックス */
	var ROW_START_INDEX = 2;	/** データ行の開始インデックス */
	var columnLength = sheet.getLastColumn();
	var values = sheet.getSheetValues(
		ROW_START_INDEX, 
		COLUMN_START_INDEX,
		sheet.getLastRow() - 1, 
		columnLength
	);

	for ( var i = 0; i < values.length; i++) {
		var customFields = [];
		var customFieldIndex = 0;
		for (var j = 13; j < columnLength; j++) {
			if (values[i][j] !== "") {
				customFields[customFieldIndex] = {
					header: getCell(sheet, j + 1, 1).getFormula(),
					value: values[i][j]
				};
				customFieldIndex++;
			}
		}
		var issue = {
			summary: values[i][0] === "" ? undefined : values[i][0],
			description: values[i][1] === "" ? undefined : values[i][1],
			startDate: values[i][2] === "" ? undefined : values[i][2],
			dueDate: values[i][3] === "" ? undefined : values[i][3],
			estimatedHours: values[i][4] === "" ? undefined : values[i][4],
			actualHours: values[i][5] === "" ? undefined : values[i][5],
			issueTypeName: values[i][6] === "" ? undefined : values[i][6],
			categoryNames: values[i][7],
			versionNames: values[i][8],
			milestoneNames: values[i][9],
			priorityName: values[i][10] === "" ? undefined : values[i][10],
			assigneeName: values[i][11] === "" ? undefined : values[i][11],
			parentIssueKey: values[i][12] === "" ? undefined : values[i][12],
			customFields: customFields
		};
		issues[i] = issue;
	}
	return issues;
}

/**
 * シート内の指定したセルを取得します
 * 
 * @param {*} sheet 
 * @param {*} column 列番号
 * @param {*} row 行番号
 */
function getCell(sheet, column, row) {
	return sheet.getRange(row, column)
}

/**
 * 文字数から文字幅を算出します
 * 
 * @param {number} length 文字数
 * @return {number} 文字幅
 */
function calcWidth(length) {
	var DEFAULT_FONT_SIZE = 10; 	/** フォントのデフォルトサイズ */
	var ADJUST_WIDTH_FACTOR = 0.75; /** 列幅調整時の係数 */
	return length * DEFAULT_FONT_SIZE * ADJUST_WIDTH_FACTOR;
}

/**
 * シート列の幅を指定します
 * 
 * @param {*} sheet 
 * @param {number} column 列番号 
 * @param {number} width 幅
 */
function setColumnWidth(sheet, column, width) {
	sheet.setColumnWidth(column, width);
}

/**
 * text の文字数を算出します
 * 
 * @param {string} 文字列 
 * @return {string} 調整済み文字数
 */
function strLength_(text) {
	var count = 0;

	for (var i = 0; i < text.length; i++) {
		var n = escape(text.charAt(i));
		if (n.length < 4)
			count += 1;
		else
			count += 2;
	}
	return count;
}
