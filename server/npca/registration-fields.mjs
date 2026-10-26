// v48.0 - Registration controls without an id are saved by their position on
// the form (scope:registration:auto:N). These are the current positions of the
// marital status, occupation and disability controls; the browser check
// tests/npca-registration-fields-browser.mjs confirms them against the real form.
export const MARITAL_POSITIONS = [['Married', 32], ['Single', 33], ['Widowed', 34], ['Divorced', 35]];
export const OCCUPATION_POSITION = 37;
export const DISABLED_POSITION = 38;
export const NOT_DISABLED_POSITION = 39;

const auto = (data, position) => data['scope:registration:auto:' + position];
const text = (value) => typeof value === 'string' ? value.trim() : '';

export function registrationMarital(data) {
  const chosen = MARITAL_POSITIONS.filter(([, position]) => auto(data, position) === true).map(([name]) => name);
  return chosen.length === 1 ? chosen[0] : '';
}
export function registrationOccupation(data) {
  const value = text(auto(data, OCCUPATION_POSITION));
  // "Other" sends the occupation typed in the box under the list.
  return value === 'ផ្សេងៗ' ? text(data['scope:registration:id:reg_occupation_other']) || value : value;
}
// The form records only disabled / not disabled, so a disabled patient is sent
// as one entry; nothing is sent when not disabled or not answered.
export function registrationDisabilities(data) {
  return auto(data, DISABLED_POSITION) === true && auto(data, NOT_DISABLED_POSITION) !== true ? ['ពិការ'] : [];
}
