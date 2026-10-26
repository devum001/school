import { describe, expect, it } from 'vitest';
import { csvValue, parseRosterCsv, readRosterFile, rosterColumns } from './liveRosterImport';
describe('live roster files', () => {
  it('parses UTF-8 BOM, quoted commas/newlines and escaped quotes without evaluating formulas', () => {
    expect(parseRosterCsv('\uFEFFCode,Name\r\nEMP-1,"A, B"\r\nEMP-2,"Line\n""Two"""')).toEqual([
      ['Code', 'Name'],
      ['EMP-1', 'A, B'],
      ['EMP-2', 'Line\n"Two"'],
    ]);
    expect(parseRosterCsv('a,b\n=1+1,@formula')).toEqual([
      ['a', 'b'],
      ['=1+1', '@formula'],
    ]);
  });
  it('rejects malformed quoting and excessive cells/rows', () => {
    expect(() => parseRosterCsv('a,"unclosed')).toThrow('unclosed');
    expect(() => parseRosterCsv('a,"closed"extra')).toThrow('quoting');
    expect(() => parseRosterCsv('a,b\n' + 'x'.repeat(301))).toThrow('300');
    expect(() => parseRosterCsv('a\n'.repeat(1003))).toThrow('1,000');
  });
  it('escapes formula prefixes and CSV syntax for downloads', () => {
    for (const value of ['=1+1', '+SUM(1)', '-1', '@value', ' \t=1'])
      expect(csvValue(value)).toMatch(/^"'/);
    expect(csvValue('A,"B"')).toBe('"A,""B"""');
  });
  it('accepts reordered headers and preserves identifier text', async () => {
    const data = [rosterColumns.staff.join(','), '001,Teacher,Yes,,,,,,'].join('\n');
    const grid = await readRosterFile(new File([data], 'staff.csv'), 'staff');
    expect(grid[1][0]).toBe('001');
    expect(grid[1]).toHaveLength(9);
    const reordered = [...rosterColumns.staff].reverse().join(',');
    expect(
      await readRosterFile(new File([`${reordered}\n,,,,,,Yes,Teacher,001`], 'staff.csv'), 'staff'),
    ).toHaveLength(2);
  });
  it('rejects wrong types, oversized files and invalid headers before uploading', async () => {
    await expect(readRosterFile(new File(['data'], 'staff.xls'), 'staff')).rejects.toThrow('.csv');
    await expect(
      readRosterFile(new File(['x'.repeat(1024 * 1024 + 1)], 'staff.csv'), 'staff'),
    ).rejects.toThrow('1 MiB');
    await expect(
      readRosterFile(new File(['Code,Name\n1,Name'], 'staff.csv'), 'staff'),
    ).rejects.toThrow('columns');
  });
});
