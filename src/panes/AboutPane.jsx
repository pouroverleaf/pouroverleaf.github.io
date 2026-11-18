import { marked } from 'marked';
import about from '../content/about.md?raw';

// The text flows into the side profile of a Hario Switch: glass cone, base, spout.
// Edit src/content/about.md. The shape holds roughly 130 words at the default size.
const html = marked.parse(about);

export default function AboutPane() {
  return (
    <div className="about">
      <div className="about-shape">
        <i className="sl" aria-hidden="true" />
        <i className="sr" aria-hidden="true" />
        <div lang="en" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
