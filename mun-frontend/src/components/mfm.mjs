// SPDX-FileCopyrightText: Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { Element } from '@mun/core';
import * as mfm from 'mfm-js';

// A native view-graph renderer, deliberately not an HTML string: note text is
// untrusted. Unsupported MFM is retained as source instead of disappearing.
export function renderMfm(text, { plain = false, nowrap = false, isNote = true } = {}) {
  const nodes = (plain ? mfm.parseSimple : mfm.parse)(text ?? '');
  const render = node => {
    const children = () => (node.children ?? []).flatMap(render);
    switch (node.type) {
      case 'text': {
        const value = node.props.text.replace(/\r\n|\r/g, '\n');
        if (plain) return value.replace(/\n/g, ' ');
        return value.split('\n').flatMap((part, index) => index ? [Element('br'), part] : [part]);
      }
      case 'bold': return Element('b', null, ...children());
      case 'italic': return Element('i', { style: 'font-style: oblique;' }, ...children());
      case 'strike': return Element('del', null, ...children());
      case 'small': return Element('small', { style: 'opacity: 0.7;' }, ...children());
      case 'center': return Element('div', { style: 'text-align: center;' }, ...children());
      case 'plain': return Element('span', null, ...children());
      case 'quote': return Element(nowrap ? 'span' : 'div', { style: 'display:block;margin:8px;padding:6px 0 6px 12px;color:var(--MI_THEME-fg);border-left:solid 3px var(--MI_THEME-fg);opacity:0.7;' }, ...children());
      case 'inlineCode': return Element('code', null, node.props.code);
      case 'blockCode': return Element('code', { lang: node.props.lang ?? undefined }, node.props.code);
      case 'mathInline': case 'mathBlock': return Element('code', null, node.props.formula);
      case 'unicodeEmoji': return node.props.emoji;
      case 'emojiCode': return `:${node.props.name}:`;
      case 'hashtag': return Element('a', { href: `/${isNote ? 'tags' : 'user-tags'}/${encodeURIComponent(node.props.hashtag)}`, style: 'color:var(--MI_THEME-hashtag);' }, `#${node.props.hashtag}`);
      default: return mfm.toString([node]);
    }
  };
  return Element('span', { style: nowrap ? 'white-space:pre;word-wrap:normal;overflow:hidden;text-overflow:ellipsis;' : 'white-space:pre-wrap;' }, ...nodes.flatMap(render));
}
