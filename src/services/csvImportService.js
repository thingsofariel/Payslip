// src/services/csvImportService.js
//
// Parses and validates a bulk-import CSV before any rows are enqueued.
// Validation happens up front, synchronously, so the admin gets an
// immediate list of problems (e.g. "row 4: employeeId not found")
// rather than discovering failures one at a time as jobs trickle
// through the queue.
//
// Expected CSV columns:
//   employeeId,periodMonth,periodYear,issueDate,issueLocation,
//   basicSalary,authorizedSignatory,earnings,deductions
//
// `earnings` and `deductions` are encoded as "label:amount|label:amount"
// within a single cell -- e.g. "Transport Allowance:500000|Meal Allowance:400000"
// This avoids needing a second file or a nested CSV structure for what
// is a 1-to-N relationship on the database side.

const { parse } = require('csv-parse/sync');

const REQUIRED_COLUMNS = [
  'employeeId',
  'periodMonth',
  'periodYear',
  'issueDate',
  'basicSalary',
  'authorizedSignatory',
];

/**
 * Parses a "label:amount|label:amount" cell into an array of
 * { label, amount } objects. Returns an empty array for blank cells.
 * Throws a descriptive error for malformed entries, rather than
 * silently dropping a bad line item.
 */
function parseLineItemsCell(cell, columnName, rowNumber) {
  if (!cell || cell.trim() === '') {
    return [];
  }
  return cell.split('|').map((entry) => {
    const parts = entry.split(':');
    if (parts.length !== 2) {
      throw new Error(
        `Row ${rowNumber}: malformed ${columnName} entry "${entry}" -- expected "label:amount".`
      );
    }
    const [label, amountStr] = parts;
    const amount = Number(amountStr.trim());
    if (!label.trim() || isNaN(amount)) {
      throw new Error(
        `Row ${rowNumber}: malformed ${columnName} entry "${entry}" -- amount must be a number.`
      );
    }
    return { label: label.trim(), amount };
  });
}

/**
 * Validates a single parsed row's basic shape and types. Does NOT
 * check whether employeeId actually exists in the database -- that
 * requires a DB call, done separately in bulkImportController.js so
 * this function stays a pure, fast, synchronous validator usable in
 * a quick unit test without a database connection.
 */
function validateRow(row, rowNumber) {
  const errors = [];

  for (const col of REQUIRED_COLUMNS) {
    if (!row[col] || String(row[col]).trim() === '') {
      errors.push(`missing required field "${col}"`);
    }
  }

  if (row.employeeId && isNaN(Number(row.employeeId))) {
    errors.push(`employeeId "${row.employeeId}" is not a number`);
  }
  if (row.periodMonth && (isNaN(Number(row.periodMonth)) || Number(row.periodMonth) < 1 || Number(row.periodMonth) > 12)) {
    errors.push(`periodMonth "${row.periodMonth}" must be a number between 1 and 12`);
  }
  if (row.periodYear && isNaN(Number(row.periodYear))) {
    errors.push(`periodYear "${row.periodYear}" is not a number`);
  }
  if (row.basicSalary && isNaN(Number(row.basicSalary))) {
    errors.push(`basicSalary "${row.basicSalary}" is not a number`);
  }
  if (row.issueDate && isNaN(new Date(row.issueDate).getTime())) {
    errors.push(`issueDate "${row.issueDate}" is not a valid date`);
  }

  let earnings = [];
  let deductions = [];
  try {
    earnings = parseLineItemsCell(row.earnings, 'earnings', rowNumber);
  } catch (err) {
    errors.push(err.message);
  }
  try {
    deductions = parseLineItemsCell(row.deductions, 'deductions', rowNumber);
  } catch (err) {
    errors.push(err.message);
  }

  return { errors, earnings, deductions };
}

/**
 * Parses raw CSV text into an array of { rowNumber, data, errors,
 * earnings, deductions } objects. Rows with validation errors are
 * still included in the result (so the caller can report them) --
 * filtering out invalid rows is left to the caller, not done here.
 */
function parseAndValidateCsv(csvText) {
  let records;
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw new Error(`Failed to parse CSV: ${err.message}`);
  }

  if (records.length === 0) {
    throw new Error('CSV file contains no data rows.');
  }

  const headerColumns = Object.keys(records[0]);
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !headerColumns.includes(c));
  if (missingColumns.length > 0) {
    throw new Error(`CSV is missing required column(s): ${missingColumns.join(', ')}`);
  }

  return records.map((row, idx) => {
    // +2 accounts for: 1-indexing, and the header row itself, so the
    // row number reported matches what the admin sees if they open
    // the CSV in a spreadsheet program.
    const rowNumber = idx + 2;
    const { errors, earnings, deductions } = validateRow(row, rowNumber);
    return { rowNumber, data: row, errors, earnings, deductions };
  });
}

module.exports = { parseAndValidateCsv, parseLineItemsCell, validateRow };
