import test from 'node:test';
import assert from 'node:assert/strict';
import {medicationTable} from '../public/medication-review.mjs';
test('medication review preserves recorded zero values, orders and safety text without internal rows',()=>{
 const orders=[{rowType:'regularRow',name:'AA0050-Amoxicillin + clavulanic acid 500 mg + 125 mg',route:'po',unit:'tablet',m:'0',a:'0',e:'1',n:'0',d:'1',total:'12',note:'<img src=x onerror=alert(1)>',protocolRepeatValue:'0',protocolMaxDoses:'0'}];
 const before=JSON.stringify(orders),html=medicationTable(orders);
 assert.equal(JSON.stringify(orders),before);assert.ok(html.includes('AA0050-Amoxicillin'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('regularRow'));assert.ok(!html.includes('protocolRepeatValue'));
 assert.ok(html.includes(': 0'));assert.ok(html.includes('>1</td>'));assert.ok(html.includes('>12</td>'));assert.equal((html.match(/<tr>/g)||[]).length,2);
});
test('protocol doses, intervals and missing fields stay explicit without dose inference',()=>{
 const html=medicationTable([{name:'Protocol medicine',rowType:'protocolRow',doseAmount:0,protocolDose:'2, 1',protocolIntervals:[{value:30,unit:'minutes'}],protocolRepeatValue:6,protocolRepeatUnit:'hours',protocolMaxDoses:4,protocolStopAt:'2026-10-28T20:00',total:0}]);
 for(const text of ['2, 1','30','6','4','2026-10-28T20:00'])assert.ok(html.includes(text));
 assert.ok(html.includes('>0</td>'));assert.ok(!html.includes('protocolRow'));assert.ok(html.includes('មិនបានកត់ត្រា'));
 assert.ok(medicationTable('not JSON <script>').includes('&lt;script&gt;'));
});
