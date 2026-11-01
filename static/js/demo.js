// With ?demo=true in the URL, adds example papers to the home page
// to preview the future paper list. All entries are made up.
(function () {
  if (new URLSearchParams(location.search).get('demo') !== 'true') return;

  var PAPERS = [
    { id: '2611.0005', cat: 'cs.CL', title: 'Robust speech recognition for Scottish English accents with limited labelled data', authors: 'A. Student, B. Student' },
    { id: '2611.0004', cat: 'cs.RO', title: 'Learning bipedal gaits from ten minutes of real-world data', authors: 'C. Student' },
    { id: '2611.0003', cat: 'cs.PL', title: 'Verified compilation of a small language with effect handlers', authors: 'D. Student, E. Student, F. Student' },
    { id: '2611.0002', cat: 'cs.LG', title: 'Sparse attention for long-context retrieval on a single GPU', authors: 'G. Student' },
    { id: '2611.0001', cat: 'physics.flu-dyn', title: 'Extraction yield as a function of grind size distribution in V60 brewing', authors: 'H. Student, I. Student' }
  ];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function link(text) {
    var a = el('a', '', text);
    a.href = '#';
    return a;
  }

  var section = el('section', 'papers');
  var h2 = el('h2', '', 'Recently shared');
  h2.appendChild(el('span', 'demo-tag', 'demo'));
  section.appendChild(h2);

  var list = el('ol', 'paper-list');
  PAPERS.forEach(function (p) {
    var li = el('li');
    var id = el('div', 'paper-id', 'pol:' + p.id + ' · ' + p.cat + ' · ');
    id.appendChild(link('pdf'));
    id.appendChild(document.createTextNode(' · '));
    id.appendChild(link('abs'));
    li.appendChild(id);
    li.appendChild(el('div', 'paper-title', p.title));
    li.appendChild(el('div', 'paper-authors', p.authors));
    list.appendChild(li);
  });
  section.appendChild(list);
  section.appendChild(el('p', 'demo-note', 'Example entries. Remove ?demo=true from the URL to hide them.'));

  document.querySelector('main').appendChild(section);
})();
