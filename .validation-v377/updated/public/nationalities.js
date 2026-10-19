// Borkeo EMR v35.0 - Nationalities & Cambodian Ethnic Groups (CIPO verified)
// Local offline dataset with dynamic single-language Khmer/English mode, dual-language search, aliases, and historical preservation.

(function () {
  'use strict';

  const CAMBODIAN_PRIMARY = [
    { kh: 'ខ្មែរ', en: 'Khmer', value: 'ខ្មែរ', aliases: ['Khmer', 'Cambodian', 'កម្ពុជា'] }
  ];

  const CAMBODIAN_ETHNIC_GROUPS = [
    { kh: 'ចាម', en: 'Cham', value: 'ចាម', aliases: ['Cham'] },
    // 24 Indigenous Groups recognized by CIPO
    { kh: 'ព្នង', en: 'Pnong', value: 'ព្នង', aliases: ['ពូនង', 'Bunong', 'Pnong'] },
    { kh: 'ទំពួន', en: 'Tampuan', value: 'ទំពួន', aliases: ['Tampuan', 'Tompuon', 'Tampuen'] },
    { kh: 'កួយ', en: 'Kuy', value: 'កួយ', aliases: ['Kuy', 'Kuoy'] },
    { kh: 'ចារ៉ាយ', en: 'Jarai', value: 'ចារ៉ាយ', aliases: ['ចារាយ', 'Jarai', 'Charay'] },
    { kh: 'គ្រឹង', en: 'Kreung', value: 'គ្រឹង', aliases: ['Kreung', 'Krung'] },
    { kh: 'ព្រៅ', en: 'Brao', value: 'ព្រៅ', aliases: ['ព្រាវ', 'Brao', 'Prao'] },
    { kh: 'កាវ៉ែត', en: 'Kavet', value: 'កាវ៉ែត', aliases: ['Kavet', 'Kravet'] },
    { kh: 'ស្ទៀង', en: 'Stieng', value: 'ស្ទៀង', aliases: ['Stieng'] },
    { kh: 'ក្រោល', en: 'Kraol', value: 'ក្រោល', aliases: ['Kraol', 'Krol'] },
    { kh: 'មិល', en: 'Mil', value: 'មិល', aliases: ['Mil', 'Mel'] },
    { kh: 'កាចក់', en: 'Kachok', value: 'កាចក់', aliases: ['Kachok', 'Kachac'] },
    { kh: 'ព័រ', en: 'Por', value: 'ព័រ', aliases: ['Por', 'Pear'] },
    { kh: 'ខោញ', en: 'Khoanh', value: 'ខោញ', aliases: ['Khoanh', 'Khaonh'] },
    { kh: 'ជង', en: 'Chong', value: 'ជង', aliases: ['Chong'] },
    { kh: 'សួយ', en: 'Suoy', value: 'សួយ', aliases: ['Suoy', 'Sui'] },
    { kh: 'ថ្មូន', en: 'Thmaun', value: 'ថ្មូន', aliases: ['Thmaun', 'Thmon'] },
    { kh: 'លុន', en: 'Lun', value: 'លុន', aliases: ['Lun'] },
    { kh: 'ស្អូច', en: 'Sa’och', value: 'ស្អូច', aliases: ['Sa\'och', 'Saoch', 'Sa’och'] },
    { kh: 'រដែ', en: 'Rade', value: 'រដែ', aliases: ['Rade', 'Rhade', 'Ede'] },
    { kh: 'ខិ', en: 'Khe', value: 'ខិ', aliases: ['Khe'] },
    { kh: 'រអង', en: 'Raang', value: 'រអង', aliases: ['Raang'] },
    { kh: 'ស្ពុង', en: 'Spung', value: 'ស្ពុង', aliases: ['Spung'] },
    { kh: 'ល្អឺន', en: 'Laeun', value: 'ល្អឺន', aliases: ['Laeun', 'Loeun'] },
    { kh: 'សំរែ', en: 'Samre', value: 'សំរែ', aliases: ['Samre'] },
    { kh: 'កូឡា', en: 'Kola', value: 'កូឡា', aliases: ['Kola', 'Kula'] }
  ];

  // Complete authoritative international countries sorted A-Z by English name (Cambodia excluded)
  const INTERNATIONAL_COUNTRIES_RAW = [
    { en: 'Afghanistan', kh: 'អាហ្វហ្គានីស្ថាន' },
    { en: 'Albania', kh: 'អាល់បានី' },
    { en: 'Algeria', kh: 'អាល់ហ្សេរី' },
    { en: 'Andorra', kh: 'អង់ដូរ៉ា' },
    { en: 'Angola', kh: 'អង់ហ្គោឡា' },
    { en: 'Antigua and Barbuda', kh: 'អង់ទីហ្កា និងបាប៊ុយដា' },
    { en: 'Argentina', kh: 'អាហ្សង់ទីន' },
    { en: 'Armenia', kh: 'អាមេនី' },
    { en: 'Australia', kh: 'អូស្ត្រាលី' },
    { en: 'Austria', kh: 'អូទ្រីស' },
    { en: 'Azerbaijan', kh: 'អាស៊ែបៃហ្សង់' },
    { en: 'Bahamas', kh: 'បាហាម៉ា' },
    { en: 'Bahrain', kh: 'បារ៉ែន' },
    { en: 'Bangladesh', kh: 'បង់ក្លាដែស' },
    { en: 'Barbados', kh: 'បាបាដូស' },
    { en: 'Belarus', kh: 'បេឡារុស' },
    { en: 'Belgium', kh: 'បែលហ្ស៊ិក' },
    { en: 'Belize', kh: 'បេលីស' },
    { en: 'Benin', kh: 'បេណាំង' },
    { en: 'Bhutan', kh: 'ប៊ូតាន' },
    { en: 'Bolivia', kh: 'បូលីវី' },
    { en: 'Bosnia and Herzegovina', kh: 'បូស្នី និងហ្វ័រហ្សេហ្គូវីណា' },
    { en: 'Botswana', kh: 'បុតស្វាណា' },
    { en: 'Brazil', kh: 'ប្រេស៊ីល' },
    { en: 'Brunei', kh: 'ប្រ៊ុយណេ' },
    { en: 'Bulgaria', kh: 'ប៊ុលហ្គារី' },
    { en: 'Burkina Faso', kh: 'បួគីណាហ្វាសូ' },
    { en: 'Burundi', kh: 'ប៊ូរុនឌី' },
    { en: 'Cabo Verde', kh: 'កាប់វែរ' },
    { en: 'Cameroon', kh: 'កាមេរូន' },
    { en: 'Canada', kh: 'កាណាដា' },
    { en: 'Central African Republic', kh: 'សាធារណរដ្ឋអាហ្វ្រិកកណ្តាល' },
    { en: 'Chad', kh: 'ឆាដ' },
    { en: 'Chile', kh: 'ស៊ីលី' },
    { en: 'China', kh: 'ចិន' },
    { en: 'Colombia', kh: 'កូឡុំប៊ី' },
    { en: 'Comoros', kh: 'កូម័រ' },
    { en: 'Congo', kh: 'កុងហ្គោ' },
    { en: 'Costa Rica', kh: 'កូស្តារីកា' },
    { en: 'Croatia', kh: 'ក្រូអាស៊ី' },
    { en: 'Cuba', kh: 'គុយបា' },
    { en: 'Cyprus', kh: 'ស៊ីប' },
    { en: 'Czech Republic', kh: 'សាធារណរដ្ឋឆែក' },
    { en: 'DR Congo', kh: 'សាធារណរដ្ឋប្រជាធិបតេយ្យកុងហ្គោ' },
    { en: 'Denmark', kh: 'ដាណឺម៉ាក' },
    { en: 'Djibouti', kh: 'ជីប៊ូទី' },
    { en: 'Dominica', kh: 'ដូមីនីកា' },
    { en: 'Dominican Republic', kh: 'សាធារណរដ្ឋដូមីនីកែន' },
    { en: 'Ecuador', kh: 'អេក្វាទ័រ' },
    { en: 'Egypt', kh: 'អេហ្ស៊ីប' },
    { en: 'El Salvador', kh: 'អែលសាល់វ៉ាឌ័រ' },
    { en: 'Equatorial Guinea', kh: 'ហ្គីណេអេក្វាទ័រ' },
    { en: 'Eritrea', kh: 'អេរីទ្រា' },
    { en: 'Estonia', kh: 'អេស្តូនី' },
    { en: 'Eswatini', kh: 'អេស៊ីវ៉ាទីនី' },
    { en: 'Ethiopia', kh: 'អេត្យូពី' },
    { en: 'Fiji', kh: 'ហ្វីជី' },
    { en: 'Finland', kh: 'ហ្វាំងឡង់' },
    { en: 'France', kh: 'បារាំង' },
    { en: 'Gabon', kh: 'ហ្គាបុង' },
    { en: 'Gambia', kh: 'ហ្គំប៊ី' },
    { en: 'Georgia', kh: 'ហ្សកហ្ស៊ី' },
    { en: 'Germany', kh: 'អាល្លឺម៉ង់' },
    { en: 'Ghana', kh: 'ហ្គាណា' },
    { en: 'Greece', kh: 'ក្រិក' },
    { en: 'Grenada', kh: 'ហ្គ្រេណាដា' },
    { en: 'Guatemala', kh: 'ក្វាតេម៉ាឡា' },
    { en: 'Guinea', kh: 'ហ្គីណេ' },
    { en: 'Guinea-Bissau', kh: 'ហ្គីណេប៊ីសាវ' },
    { en: 'Guyana', kh: 'ហ្គីយ៉ាណា' },
    { en: 'Haiti', kh: 'ហៃទី' },
    { en: 'Honduras', kh: 'ហុងឌូរ៉ាស' },
    { en: 'Hungary', kh: 'ហុងគ្រី' },
    { en: 'Iceland', kh: 'អ៊ីស្លង់' },
    { en: 'India', kh: 'ឥណ្ឌា' },
    { en: 'Indonesia', kh: 'ឥណ្ឌូនេស៊ី' },
    { en: 'Iran', kh: 'អ៊ីរ៉ង់' },
    { en: 'Iraq', kh: 'អ៊ីរ៉ាក់' },
    { en: 'Ireland', kh: 'អៀរឡង់' },
    { en: 'Israel', kh: 'អ៊ីស្រាអែល' },
    { en: 'Italy', kh: 'អ៊ីតាលី' },
    { en: 'Ivory Coast', kh: 'កូតឌីវ័រ' },
    { en: 'Jamaica', kh: 'ហ្សាម៉ាអ៊ីក' },
    { en: 'Japan', kh: 'ជប៉ុន' },
    { en: 'Jordan', kh: 'ហ្ស៊កដានី' },
    { en: 'Kazakhstan', kh: 'កាហ្សាក់ស្ថាន' },
    { en: 'Kenya', kh: 'កេនយ៉ា' },
    { en: 'Kiribati', kh: 'គិរីបាទី' },
    { en: 'Kuwait', kh: 'គុយវ៉ែត' },
    { en: 'Kyrgyzstan', kh: 'កៀហ្ស៊ីស៊ីស្ថាន' },
    { en: 'Laos', kh: 'ឡាវ' },
    { en: 'Latvia', kh: 'ឡាតវី' },
    { en: 'Lebanon', kh: 'លីបង់' },
    { en: 'Lesotho', kh: 'ឡេសូតូ' },
    { en: 'Liberia', kh: 'លីបេរីយ៉ា' },
    { en: 'Libya', kh: 'លីប៊ី' },
    { en: 'Liechtenstein', kh: 'លិចតិនស្តាញ' },
    { en: 'Lithuania', kh: 'លីទុយអានី' },
    { en: 'Luxembourg', kh: 'លុចសំបួរ' },
    { en: 'Madagascar', kh: 'ម៉ាដាហ្គាស្កា' },
    { en: 'Malawi', kh: 'ម៉ាឡាវី' },
    { en: 'Malaysia', kh: 'ម៉ាឡេស៊ី' },
    { en: 'Maldives', kh: 'ម៉ាល់ឌីវ' },
    { en: 'Mali', kh: 'ម៉ាលី' },
    { en: 'Malta', kh: 'ម៉ាល់ត៍' },
    { en: 'Marshall Islands', kh: 'កោះម៉ាសាល់' },
    { en: 'Mauritania', kh: 'ម៉ូរីតានី' },
    { en: 'Mauritius', kh: 'ម៉ូរីស' },
    { en: 'Mexico', kh: 'ម៉ិកស៊ិក' },
    { en: 'Micronesia', kh: 'មីក្រូណេស៊ី' },
    { en: 'Moldova', kh: 'ម៉ុលដាវី' },
    { en: 'Monaco', kh: 'ម៉ូណាកូ' },
    { en: 'Mongolia', kh: 'ម៉ុងហ្គោលី' },
    { en: 'Montenegro', kh: 'ម៉ុងតេណេហ្គ្រោ' },
    { en: 'Morocco', kh: 'ម៉ារ៉ុក' },
    { en: 'Mozambique', kh: 'ម៉ូសំប៊ិក' },
    { en: 'Myanmar', kh: 'មីយ៉ាន់ម៉ា' },
    { en: 'Namibia', kh: 'ណាមីប៊ី' },
    { en: 'Nauru', kh: 'ណូរ៉ូ' },
    { en: 'Nepal', kh: 'នេប៉ាល់' },
    { en: 'Netherlands', kh: 'ហូឡង់' },
    { en: 'New Zealand', kh: 'នូវែលសេឡង់' },
    { en: 'Nicaragua', kh: 'នីការ៉ាហ្គា' },
    { en: 'Niger', kh: 'នីហ្សេ' },
    { en: 'Nigeria', kh: 'នីហ្សេរីយ៉ា' },
    { en: 'North Korea', kh: 'កូរ៉េខាងជើង' },
    { en: 'North Macedonia', kh: 'ម៉ាសេដូនីខាងជើង' },
    { en: 'Norway', kh: 'ន័រវែស' },
    { en: 'Oman', kh: 'អូម៉ង់' },
    { en: 'Pakistan', kh: 'ប៉ាគីស្ថាន' },
    { en: 'Palau', kh: 'ប៉ាឡូ' },
    { en: 'Palestine', kh: 'ប៉ាឡេស្ទីន' },
    { en: 'Panama', kh: 'ប៉ាណាម៉ា' },
    { en: 'Papua New Guinea', kh: 'ប៉ាពួញូហ្គីណេ' },
    { en: 'Paraguay', kh: 'ប៉ារ៉ាហ្គាយ' },
    { en: 'Peru', kh: 'ប៉េរូ' },
    { en: 'Philippines', kh: 'ហ្វីលីពីន' },
    { en: 'Poland', kh: 'ប៉ូឡូញ' },
    { en: 'Portugal', kh: 'ព័រទុយហ្កាល់' },
    { en: 'Qatar', kh: 'កាតា' },
    { en: 'Romania', kh: 'រូម៉ានី' },
    { en: 'Russia', kh: 'រុស្ស៊ី' },
    { en: 'Rwanda', kh: 'រវ៉ាន់ដា' },
    { en: 'Saint Kitts and Nevis', kh: 'សាំងគីត និងណេវីស' },
    { en: 'Saint Lucia', kh: 'សាំងលូស៊ី' },
    { en: 'Saint Vincent and the Grenadines', kh: 'សាំងវ៉ាំងសង់ និងហ្គ្រេណាឌីន' },
    { en: 'Samoa', kh: 'សាម័រ' },
    { en: 'San Marino', kh: 'សានម៉ារីណូ' },
    { en: 'Sao Tome and Principe', kh: 'សៅតូមេ និងព្រីនស៊ីពី' },
    { en: 'Saudi Arabia', kh: 'អារ៉ាប៊ីសាអ៊ូឌីត' },
    { en: 'Senegal', kh: 'សេណេហ្គាល់' },
    { en: 'Serbia', kh: 'ស៊ែប៊ី' },
    { en: 'Seychelles', kh: 'សីស្ហែល' },
    { en: 'Sierra Leone', kh: 'សៀរ៉ាឡេអូន' },
    { en: 'Singapore', kh: 'សិង្ហបុរី' },
    { en: 'Slovakia', kh: 'ស្លូវ៉ាគី' },
    { en: 'Slovenia', kh: 'ស្លូវេនី' },
    { en: 'Solomon Islands', kh: 'កោះសូឡូម៉ុន' },
    { en: 'Somalia', kh: 'សូម៉ាលី' },
    { en: 'South Africa', kh: 'អាហ្វ្រិកខាងត្បូង' },
    { en: 'South Korea', kh: 'កូរ៉េខាងត្បូង' },
    { en: 'South Sudan', kh: 'ស៊ូដង់ខាងត្បូង' },
    { en: 'Spain', kh: 'អេស្ប៉ាញ' },
    { en: 'Sri Lanka', kh: 'ស្រីលង្កា' },
    { en: 'Sudan', kh: 'ស៊ូដង់' },
    { en: 'Suriname', kh: 'ស៊ូរីណាម' },
    { en: 'Sweden', kh: 'ស៊ុយអែត' },
    { en: 'Switzerland', kh: 'ស្វីស' },
    { en: 'Syria', kh: 'ស៊ីរី' },
    { en: 'Taiwan', kh: 'តៃវ៉ាន់' },
    { en: 'Tajikistan', kh: 'តាជីគីស្ថាន' },
    { en: 'Tanzania', kh: 'តង់ហ្សានី' },
    { en: 'Thailand', kh: 'ថៃ' },
    { en: 'Timor-Leste', kh: 'ទីម័រខាងកើត' },
    { en: 'Togo', kh: 'តូហ្គោ' },
    { en: 'Tonga', kh: 'តុងហ្គា' },
    { en: 'Trinidad and Tobago', kh: 'ទ្រីនីដាដ និងតូបាហ្គោ' },
    { en: 'Tunisia', kh: 'ទុយនីស៊ី' },
    { en: 'Turkey', kh: 'តួកគី' },
    { en: 'Turkmenistan', kh: 'តួកមេនីស្ថាន' },
    { en: 'Tuvalu', kh: 'ទូវ៉ាលូ' },
    { en: 'Uganda', kh: 'អ៊ូហ្គង់ដា' },
    { en: 'Ukraine', kh: 'អ៊ុយក្រែន' },
    { en: 'United Arab Emirates', kh: 'អារ៉ាប់រួម' },
    { en: 'United Kingdom', kh: 'ចក្រភពអង់គ្លេស' },
    { en: 'United States', kh: 'សហរដ្ឋអាមេរិក' },
    { en: 'Uruguay', kh: 'អ៊ុយរ៉ាហ្គាយ' },
    { en: 'Uzbekistan', kh: 'អ៊ូសបេគីស្ថាន' },
    { en: 'Vanuatu', kh: 'វ៉ានូអាទូ' },
    { en: 'Vatican City', kh: 'បុរីវ៉ាទីកង់' },
    { en: 'Venezuela', kh: 'វ៉េណេស៊ុយអេឡា' },
    { en: 'Vietnam', kh: 'វៀតណាម' },
    { en: 'Yemen', kh: 'យេម៉ែន' },
    { en: 'Zambia', kh: 'ហ្សំប៊ី' },
    { en: 'Zimbabwe', kh: 'ហ្ស៊ីមបាវ៉េ' }
  ].sort((a, b) => a.en.localeCompare(b.en));

  const INTERNATIONAL_COUNTRIES = INTERNATIONAL_COUNTRIES_RAW.map(c => ({
    kh: c.kh,
    en: c.en,
    value: `${c.kh} / ${c.en}`,
    aliases: [c.en, c.kh]
  }));

  const OTHER_ENTRIES = [
    { kh: 'ផ្សេងៗ', en: 'Other', value: 'ផ្សេងៗ', aliases: ['Other', 'ផ្សេងទៀត'] },
    { kh: 'មិនបានបញ្ជាក់', en: 'Not specified', value: 'មិនបានបញ្ជាក់', aliases: ['Not specified', 'Unspecified'] }
  ];

  function isEnglish(explicitLang) {
    if (explicitLang) {
      const el = String(explicitLang).toLowerCase();
      if (el === 'en' || el === 'english') return true;
      if (el === 'kh' || el === 'km' || el === 'khmer') return false;
    }
    if (typeof window !== 'undefined') {
      if (typeof window.getBorkeoLanguage === 'function') {
        const l = String(window.getBorkeoLanguage() || '').toLowerCase();
        if (l === 'en' || l === 'english') return true;
        if (l === 'kh' || l === 'km' || l === 'khmer') return false;
      }
      if (typeof window.currentLang !== 'undefined') {
        const cl = String(window.currentLang || '').toLowerCase();
        if (cl === 'english' || cl === 'en') return true;
        if (cl === 'khmer' || cl === 'kh' || cl === 'km') return false;
      }
      if (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang === 'en') {
        return true;
      }
    }
    return false;
  }

  const GROUPS = [
    {
      id: 'cambodia',
      labelKh: 'កម្ពុជា',
      labelEn: 'Cambodia',
      get displayLabel() {
        return isEnglish() ? this.labelEn : this.labelKh;
      },
      items: CAMBODIAN_PRIMARY
    },
    {
      id: 'cambodian_ethnic',
      labelKh: 'ជនជាតិដើមភាគតិច និងជនជាតិភាគតិចកម្ពុជា',
      labelEn: 'Cambodian Ethnic Groups',
      get displayLabel() {
        return isEnglish() ? this.labelEn : this.labelKh;
      },
      items: CAMBODIAN_ETHNIC_GROUPS
    },
    {
      id: 'international',
      labelKh: 'សញ្ជាតិអន្តរជាតិ',
      labelEn: 'International Nationalities',
      get displayLabel() {
        return isEnglish() ? this.labelEn : this.labelKh;
      },
      items: INTERNATIONAL_COUNTRIES
    },
    {
      id: 'other',
      labelKh: 'ផ្សេងៗ',
      labelEn: 'Other',
      get displayLabel() {
        return isEnglish() ? this.labelEn : this.labelKh;
      },
      items: OTHER_ENTRIES
    }
  ];

  // Flattened list for fast lookup
  const ALL_ENTRIES = [];
  GROUPS.forEach(g => {
    g.items.forEach(item => {
      ALL_ENTRIES.push({
        ...item,
        groupId: g.id,
        groupLabelKh: g.labelKh,
        groupLabelEn: g.labelEn,
        get groupLabel() {
          return isEnglish() ? g.labelEn : g.labelKh;
        },
        get displayLabel() {
          return isEnglish() ? item.en : item.kh;
        }
      });
    });
  });

  // Alias / normalization map
  const ALIAS_MAP = new Map();
  ALL_ENTRIES.forEach(entry => {
    ALIAS_MAP.set(entry.value.toLowerCase(), entry);
    ALIAS_MAP.set(`${entry.kh} / ${entry.en}`.toLowerCase(), entry);
    ALIAS_MAP.set(entry.kh.toLowerCase(), entry);
    ALIAS_MAP.set(entry.en.toLowerCase(), entry);
    (entry.aliases || []).forEach(alias => {
      ALIAS_MAP.set(alias.toLowerCase(), entry);
    });
  });

  // Explicit historical mappings
  // "ពូនង" or "Bunong" -> maps to entry "ព្នង"
  // "ចារាយ" -> maps to entry "ចារ៉ាយ"
  // Note: "ទួន" is historical and preserved as-is, never mapped to Tampuan for existing records.

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatLabel(value, lang) {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (!trimmed) return '';

    // If historical "ទួន", return preserved label
    if (trimmed === 'ទួន') {
      if (lang === 'bilingual') return 'ទួន (ប្រវត្តិ / Historical)';
      return isEnglish(lang) ? 'Tuon (Historical record)' : 'ទួន';
    }

    const match = ALIAS_MAP.get(trimmed.toLowerCase());
    if (match) {
      if (lang === 'bilingual') return `${match.kh} / ${match.en}`;
      return isEnglish(lang) ? match.en : match.kh;
    }

    return trimmed;
  }

  function findEntry(value) {
    if (!value) return null;
    const trimmed = String(value).trim().toLowerCase();
    return ALIAS_MAP.get(trimmed) || null;
  }

  let activeDropdownInstance = null;

  class SearchableNationalityDropdown {
    constructor(selectElem) {
      this.selectElem = selectElem;
      this.isOpen = false;
      this.highlightIndex = -1;
      this.filteredItems = [];
      activeDropdownInstance = this;
      this.init();
    }

    init() {
      if (!this.selectElem || this.selectElem.dataset.emrNatReady) return;
      this.selectElem.dataset.emrNatReady = 'true';

      // Ensure select element has all current grouped options in active language
      this.populateSelectOptions();

      // Wrap select
      const parent = this.selectElem.parentElement;
      this.wrapper = document.createElement('div');
      this.wrapper.className = 'emr-nat-wrapper';

      this.combobox = document.createElement('div');
      this.combobox.className = 'emr-nat-combobox';

      this.btn = document.createElement('button');
      this.btn.type = 'button';
      this.btn.className = 'emr-nat-btn';
      this.btn.innerHTML = `
        <span class="btn-text"></span>
        <span class="btn-chevron"><i class="fa-solid fa-chevron-down"></i></span>
      `;

      this.popover = document.createElement('div');
      this.popover.className = 'emr-nat-popover';
      this.popover.hidden = true;

      this.searchBox = document.createElement('div');
      this.searchBox.className = 'emr-nat-search-box';
      this.searchInput = document.createElement('input');
      this.searchInput.type = 'search';
      this.searchInput.className = 'emr-nat-search-input';
      this.searchInput.placeholder = isEnglish() ? 'Search nationality/ethnicity...' : 'ស្វែងរកជនជាតិ/សញ្ជាតិ...';
      // Mark as transient so emr-patient-record.js prepareStorageKeys skips it!
      this.searchInput.setAttribute('data-emr-transient', '');
      this.searchInput.setAttribute('data-emr-no-auto-index', '');
      this.searchBox.appendChild(this.searchInput);

      this.listElem = document.createElement('ul');
      this.listElem.className = 'emr-nat-list';

      this.popover.appendChild(this.searchBox);
      this.popover.appendChild(this.listElem);

      this.combobox.appendChild(this.btn);
      this.combobox.appendChild(this.popover);

      // Hide native select visually while keeping it in the form DOM for form serialization
      this.selectElem.style.position = 'absolute';
      this.selectElem.style.opacity = '0';
      this.selectElem.style.pointerEvents = 'none';
      this.selectElem.style.width = '0';
      this.selectElem.style.height = '0';
      this.selectElem.style.margin = '0';
      this.selectElem.style.padding = '0';
      this.selectElem.setAttribute('aria-hidden', 'true');

      parent.insertBefore(this.wrapper, this.selectElem);
      this.wrapper.appendChild(this.combobox);
      this.wrapper.appendChild(this.selectElem);

      // Bind events
      this.btn.addEventListener('click', () => this.toggle());

      this.searchInput.addEventListener('input', () => {
        this.renderFilteredList(this.searchInput.value);
      });

      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.moveHighlight(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.moveHighlight(-1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (this.highlightIndex >= 0 && this.highlightIndex < this.filteredItems.length) {
            this.selectItem(this.filteredItems[this.highlightIndex]);
          } else if (this.filteredItems.length > 0) {
            this.selectItem(this.filteredItems[0]);
          }
        }
      });

      document.addEventListener('click', (e) => {
        if (this.isOpen && !this.wrapper.contains(e.target)) {
          this.close();
        }
      });

      // Synchronize when the select value changes programmatically
      this.selectElem.addEventListener('change', () => {
        this.syncButtonFromSelect();
      });

      if (typeof window !== 'undefined') {
        window.addEventListener('borkeo-language-change', () => this.syncLanguage());
        window.addEventListener('languagechange', () => this.syncLanguage());
      }

      // Hook property setter to catch direct assignments like control.value = '...'
      const self = this;
      const originalValueProp = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
      if (originalValueProp && originalValueProp.set) {
        Object.defineProperty(this.selectElem, 'value', {
          get() {
            return originalValueProp.get.call(this);
          },
          set(val) {
            self.handleExternalValueChange(val, originalValueProp);
          },
          configurable: true
        });
      }

      this.syncButtonFromSelect();
    }

    populateSelectOptions() {
      // Preserve current selected value if any
      const currentVal = this.selectElem.value;
      const english = isEnglish();

      // Clear existing options
      this.selectElem.innerHTML = '';

      GROUPS.forEach(g => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = english ? g.labelEn : g.labelKh;
        g.items.forEach(item => {
          const opt = document.createElement('option');
          opt.value = item.value;
          opt.textContent = english ? item.en : item.kh;
          if (item.aliases && item.aliases.length) {
            opt.dataset.aliases = item.aliases.join(',');
          }
          optgroup.appendChild(opt);
        });
        this.selectElem.appendChild(optgroup);
      });

      if (currentVal) {
        this.setValue(currentVal, false);
      } else {
        // Default to Khmer
        this.selectElem.value = 'ខ្មែរ';
      }
    }

    handleExternalValueChange(val, originalDescriptor) {
      if (!val) {
        originalDescriptor.set.call(this.selectElem, '');
        this.syncButtonFromSelect();
        return;
      }

      const english = isEnglish();
      // Check if value is a known entry or alias
      const entry = findEntry(val);
      if (entry) {
        originalDescriptor.set.call(this.selectElem, entry.value);
      } else if (val === 'ទួន') {
        // Preserve historical value "ទួន"
        let historicalOpt = Array.from(this.selectElem.options).find(o => o.value === 'ទួន');
        if (!historicalOpt) {
          historicalOpt = new Option(english ? 'Tuon (Historical record)' : 'ទួន (ប្រវត្តិ)', 'ទួន');
          historicalOpt.dataset.historical = 'true';
          this.selectElem.appendChild(historicalOpt);
        }
        originalDescriptor.set.call(this.selectElem, 'ទួន');
      } else {
        // Any other historical value not in catalog
        let customOpt = Array.from(this.selectElem.options).find(o => o.value === val);
        if (!customOpt) {
          customOpt = new Option(val, val);
          this.selectElem.appendChild(customOpt);
        }
        originalDescriptor.set.call(this.selectElem, val);
      }

      this.syncButtonFromSelect();
    }

    setValue(val, triggerChange = true) {
      const english = isEnglish();
      const entry = findEntry(val);
      if (entry) {
        this.selectElem.value = entry.value;
      } else if (val === 'ទួន') {
        let historicalOpt = Array.from(this.selectElem.options).find(o => o.value === 'ទួន');
        if (!historicalOpt) {
          historicalOpt = new Option(english ? 'Tuon (Historical record)' : 'ទួន (ប្រវត្តិ)', 'ទួន');
          this.selectElem.appendChild(historicalOpt);
        }
        this.selectElem.value = 'ទួន';
      } else if (val) {
        let customOpt = Array.from(this.selectElem.options).find(o => o.value === val);
        if (!customOpt) {
          customOpt = new Option(val, val);
          this.selectElem.appendChild(customOpt);
        }
        this.selectElem.value = val;
      }

      this.syncButtonFromSelect();

      if (triggerChange) {
        this.selectElem.dispatchEvent(new Event('change', { bubbles: true }));
        this.selectElem.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    syncButtonFromSelect() {
      const selOpt = this.selectElem.selectedIndex >= 0 ? this.selectElem.options[this.selectElem.selectedIndex] : null;
      const textSpan = this.btn.querySelector('.btn-text');
      const english = isEnglish();
      if (selOpt && selOpt.value) {
        textSpan.textContent = formatLabel(selOpt.value, english ? 'en' : 'kh') || selOpt.textContent;
        textSpan.classList.remove('placeholder');
      } else {
        textSpan.textContent = english ? 'Select nationality/ethnicity...' : 'ជ្រើសរើសជនជាតិ/សញ្ជាតិ...';
        textSpan.classList.add('placeholder');
      }
    }

    syncLanguage(lang) {
      const english = isEnglish(lang);
      if (this.renderedEnglish === english) return;
      this.renderedEnglish = english;
      if (this.searchInput) {
        this.searchInput.placeholder = english ? 'Search nationality/ethnicity...' : 'ស្វែងរកជនជាតិ/សញ្ជាតិ...';
      }
      const items = new Map(GROUPS.flatMap(group => group.items.map(item => [item.value, item])));
      for (const option of this.selectElem.options) {
        const item = items.get(option.value);
        if (item) {
          const label = english ? item.en : item.kh;
          if (option.textContent !== label) option.textContent = label;
        }
      }
      const groups = this.selectElem.querySelectorAll('optgroup');
      GROUPS.forEach((group, index) => {
        const label = english ? group.labelEn : group.labelKh;
        if (groups[index] && groups[index].label !== label) groups[index].label = label;
      });
      this.syncButtonFromSelect();
      if (this.isOpen) this.renderFilteredList(this.searchInput ? this.searchInput.value : '');
    }

    open() {
      this.isOpen = true;
      this.combobox.classList.add('open');
      this.popover.hidden = false;
      this.searchInput.value = '';
      this.renderFilteredList('');
      setTimeout(() => this.searchInput.focus(), 10);
    }

    close() {
      this.isOpen = false;
      this.combobox.classList.remove('open');
      this.popover.hidden = true;
      this.highlightIndex = -1;
    }

    toggle() {
      if (this.isOpen) this.close();
      else this.open();
    }

    renderFilteredList(query) {
      const q = String(query || '').trim().toLowerCase();
      const english = isEnglish();
      this.listElem.innerHTML = '';
      this.filteredItems = [];
      this.highlightIndex = -1;

      // Group matches by group id
      const matchesByGroup = new Map();
      GROUPS.forEach(g => matchesByGroup.set(g.id, []));

      ALL_ENTRIES.forEach(entry => {
        let match = false;
        if (!q) {
          match = true;
        } else {
          if (entry.kh.toLowerCase().includes(q)) match = true;
          else if (entry.en.toLowerCase().includes(q)) match = true;
          else if ((entry.aliases || []).some(a => a.toLowerCase().includes(q))) match = true;
        }

        if (match) {
          matchesByGroup.get(entry.groupId).push(entry);
        }
      });

      const currentSelectedVal = this.selectElem.value;
      let totalMatches = 0;

      GROUPS.forEach(g => {
        const groupItems = matchesByGroup.get(g.id) || [];
        if (groupItems.length === 0) return;

        totalMatches += groupItems.length;

        // Group Header
        const header = document.createElement('li');
        header.className = 'emr-nat-group-header';
        header.textContent = english ? g.labelEn : g.labelKh;
        this.listElem.appendChild(header);

        groupItems.forEach(item => {
          this.filteredItems.push(item);
          const itemIndex = this.filteredItems.length - 1;

          const li = document.createElement('li');
          li.className = 'emr-nat-item';
          li.dataset.itemIndex = String(itemIndex);
          if (item.value === currentSelectedVal) {
            li.classList.add('selected');
          }

          const labelText = english ? item.en : item.kh;
          li.innerHTML = `<span class="item-label">${esc(labelText)}</span>`;

          li.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectItem(item);
          });

          this.listElem.appendChild(li);
        });
      });

      // Check if current value is historical "ទួន" and should be shown
      if (currentSelectedVal === 'ទួន' && (!q || 'ទួន'.includes(q) || 'tampuan'.includes(q) || 'tuon'.includes(q))) {
        const histKh = 'ទួន (ប្រវត្តិ)';
        const histEn = 'Tuon (Historical record)';
        const historicalItem = {
          kh: histKh,
          en: histEn,
          value: 'ទួន',
          get displayLabel() { return english ? histEn : histKh; }
        };
        this.filteredItems.push(historicalItem);
        const itemIndex = this.filteredItems.length - 1;

        const li = document.createElement('li');
        li.className = 'emr-nat-item selected';
        li.dataset.itemIndex = String(itemIndex);
        li.innerHTML = `<span class="item-label">${esc(english ? histEn : histKh)}</span>`;
        li.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectItem(historicalItem);
        });
        this.listElem.appendChild(li);
        totalMatches += 1;
      }

      if (totalMatches === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.className = 'emr-nat-item-empty';
        emptyLi.textContent = english ? 'No matching nationality found' : 'រកមិនឃើញជនជាតិ ឬសញ្ជាតិនេះទេ';
        this.listElem.appendChild(emptyLi);
      }
    }

    moveHighlight(delta) {
      if (this.filteredItems.length === 0) return;
      this.highlightIndex += delta;
      if (this.highlightIndex < 0) this.highlightIndex = this.filteredItems.length - 1;
      if (this.highlightIndex >= this.filteredItems.length) this.highlightIndex = 0;

      const items = this.listElem.querySelectorAll('.emr-nat-item');
      items.forEach((item, idx) => {
        if (idx === this.highlightIndex) {
          item.classList.add('highlighted');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('highlighted');
        }
      });
    }

    selectItem(item) {
      this.setValue(item.value, true);
      this.close();
      this.btn.focus();
    }
  }

  // Exported global API
  window.EMRNationalities = {
    groups: GROUPS,
    allEntries: ALL_ENTRIES,
    formatLabel,
    findEntry,
    isEnglish,
    syncLanguage(lang) {
      if (activeDropdownInstance) {
        activeDropdownInstance.syncLanguage(lang);
      }
    },
    getInstance() {
      return activeDropdownInstance;
    },
    init() {
      if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
      const select = document.getElementById('web_nat');
      if (select && !select.dataset.emrNatReady) {
        new SearchableNationalityDropdown(select);
      }
    }
  };

  // Auto-initialize when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      if (typeof document.addEventListener === 'function') {
        document.addEventListener('DOMContentLoaded', () => window.EMRNationalities.init());
      }
    } else {
      window.EMRNationalities.init();
    }
  }
})();
