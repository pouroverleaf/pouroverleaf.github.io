// Shared formatting for the inventory and coffee references in session Markdown.
const escape = (value) => String(value).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function coffeeHeading(coffee) {
  return [coffee.roaster, coffee.name].filter(Boolean).join(' · ');
}

export function coffeeDetails(coffee, inventory = false) {
  const origin = [coffee.region, coffee.country].filter(Boolean).join(', ');
  const fields = [origin, coffee.process, coffee.variety, coffee.roast, coffee.altitude];
  if (inventory) fields.push(coffee.format, coffee.bag_g && coffee.bag_g + ' g bag');
  const meta = fields.filter(Boolean).map(escape).join(' · ');
  const url = /^https?:\/\//i.test(coffee.source || '') ? coffee.source : '';
  return [
    meta && '<p class="coffee-meta">' + meta + '</p>',
    coffee.producer && '<p>Producer · ' + escape(coffee.producer) + '</p>',
    coffee.listed_notes && '<p>Listed notes · ' + escape(coffee.listed_notes) + '</p>',
    url && '<p><a href="' + escape(url) + '">Product listing</a></p>',
  ].filter(Boolean).join('\n');
}

export function renderSession(body, coffees, markdown) {
  return body.split(/^(?=## )/m).map((section) => {
    if (!/^## Coffee lineup[ \t]*\r?$/m.test(section)) return markdown(section);
    const part = section.replace(/^## Coffee lineup[ \t]*\r?\n?/, '');
    let number = 0;
    return part.split(/^(?=### )/m).map(block => {
      const line = block.match(/^### ([^\r\n]+)\r?\n?/);
      if (!line) return markdown(block);
      const title = line[1];
      const match = title.match(/^\[([^\]]+)\]\(\.\.\/coffees\/([\w-]+)\.md\)$/);
      const coffee = match && coffees.find((item) => item.id === match[2]);
      if (match && !coffee) throw new Error('Missing coffee profile: ' + match[2]);
      const heading = coffee ? coffeeHeading(coffee) : title;
      const prefix = String(++number).padStart(2, '0');
      return '<section class="coffee-entry"><h3 class="coffee-heading">' + prefix + ' / ' + escape(heading) + '</h3>\n\n' +
        (coffee ? coffeeDetails(coffee) : '') + markdown(block.slice(line[0].length)) + '</section>';
    }).join('');
  }).join('');
}
