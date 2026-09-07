const CATEGORY_LABELS = {
  aidat: 'Aidat',
  tamir: 'Tamir ve bakım',
  vergi: 'Vergi',
  sigorta: 'Sigorta',
  komisyon: 'Komisyon',
  fatura: 'Fatura',
  diger: 'Diğer',
};

function categoryLabel(value) {
  return CATEGORY_LABELS[value] || CATEGORY_LABELS.diger;
}

module.exports = { CATEGORY_LABELS, categoryLabel };
