const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

for (const version of ['2.6.0', '2.6.2', '2.7.0', '2.8.0', '2.9.1']) {
  const source = fs.readFileSync(path.join(__dirname, '..', `booking_widget_renderer-${version}.js`), 'utf8');
  // Exercise the maintained minified renderer's actual URL construction, without a browser or widget request.
  const fragment = source.match(/src\+='\?checkin='[\s\S]*?;mount\.innerHTML/);
  assert(fragment, `Missing booking URL construction in ${version}`);
  const construction = fragment[0].replace(/;mount\.innerHTML$/, '');
  test(`${version}: booking fields stay URL data, never HTML attribute delimiters`, () => {
    const malicious = '"></iframe><button data-marker="audit">x</button><iframe src="&adults=99';
    const input = { ci: '2026-11-01', co: '2026-11-03', ad: '2', ch: '0', pe: '0', inf: '0' };
    for (const field of Object.keys(input)) {
      const values = { ...input, [field]: malicious };
      const url = vm.runInNewContext(`var src='https://booking.hospitable.com/widget/fixture';${construction};src`, values, { timeout: 1000 });
      assert(!/[<>"\s]/.test(url));
      const params = new URL(url).searchParams;
      const names = { ci: 'checkin', co: 'checkout', ad: 'adults', ch: 'children', pe: 'pets', inf: 'infants' };
      for (const [key, name] of Object.entries(names)) assert.equal(params.get(name), values[key]);
      assert.equal(params.getAll('adults').length, 1);
    }
  });
  test(`${version}: normal dates and guest counts round trip unchanged`, () => {
    const url = vm.runInNewContext(`var src='https://booking.hospitable.com/widget/fixture';${construction};src`, { ci: '2026-11-01', co: '2026-11-03', ad: '2', ch: '', pe: '', inf: '' }, { timeout: 1000 });
    assert.equal(new URL(url).searchParams.get('checkin'), '2026-11-01');
    assert.equal(new URL(url).searchParams.get('adults'), '2');
  });
}
