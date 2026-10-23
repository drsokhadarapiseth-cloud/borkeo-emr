"""Development-only Excel reader. Python standard library; no runtime dependency.
Rebuild the NPCA reference snapshot from the owner's original workbooks.
"""
import hashlib
import json
import pathlib
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'borkeo-update-files/npca'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def workbook(file):
    with zipfile.ZipFile(file) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        rels = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        result = {}
        for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet', NS):
            target = rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            rows = []
            for row in ET.fromstring(z.read(target)).findall('s:sheetData/s:row', NS):
                values = []
                for cell in row.findall('s:c', NS):
                    col = 0
                    for letter in re.match('[A-Z]+', cell.attrib['r'])[0]:
                        col = col * 26 + ord(letter) - 64
                    while len(values) < col:
                        values.append('')
                    val = cell.find('s:v', NS)
                    text = val.text if val is not None and val.text else ''
                    if cell.attrib.get('t') == 's':
                        text = strings[int(text)]
                    elif cell.attrib.get('t') == 'inlineStr':
                        text = ''.join(cell.find('s:is', NS).itertext())
                    values[col-1] = text.strip()
                while values and not values[-1]:
                    values.pop()
                if any(values):
                    rows.append(values)
            result[sheet.attrib['name']] = rows
        return result

files = ['external_standard_data_structure_v1.4.xlsx', 'external_standard_data_references_v1.4.xlsx', 'clinical_data_form_v1.4.xlsx']
output = {'version': '1.4', 'sources': {f: hashlib.sha256((SOURCE/f).read_bytes()).hexdigest() for f in files}, 'workbooks': {f: workbook(SOURCE/f) for f in files}}
(ROOT/'server/npca/standards.json').write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Extracted the three original NPCA workbooks to server/npca/standards.json')
