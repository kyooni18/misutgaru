// SPDX-FileCopyrightText: Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { Element } from '@mun/core';
import * as mfm from 'mfm-js';
import { toUnicode } from 'punycode.js';
import './mfm.css';

const color = value => typeof value === 'string' && /^[0-9a-f]{3,6}$/i.test(value) ? value : null;
const number = (value, fallback) => typeof value === 'string' && value !== '' && !Number.isNaN(parseFloat(value)) ? parseFloat(value) : fallback;
const time = (value, fallback) => typeof value === 'string' && /^-?[0-9.]+s$/.test(value) ? value : fallback;

function renderFunction(node, children, advancedMfm, animatedMfm) {
  const { name, args } = node.props;
  if (['x2', 'x3', 'x4'].includes(name)) return Element('span', { class: advancedMfm ? `mfm-${name}` : '' }, ...children);
  if (name === 'blur') return Element('span', { class: '_mfm_blur_' }, ...children);
  let style;
  const useAnim = advancedMfm && animatedMfm;
  const delay = time(args.delay, '0s');
  switch (name) {
    case 'tada': style = 'font-size: 150%;' + (useAnim ? `animation: global-tada ${time(args.speed, '1s')} linear infinite both; animation-delay: ${delay};` : ''); break;
    case 'jelly': style = useAnim ? `animation: mfm-rubberBand ${time(args.speed, '1s')} linear infinite both; animation-delay: ${delay};` : ''; break;
    case 'twitch': case 'shake': style = useAnim ? `animation: mfm-${name} ${time(args.speed, '0.5s')} ease infinite; animation-delay: ${delay};` : ''; break;
    case 'rainbow': {
      if (!useAnim) return Element('span', { class: '_mfm_rainbow_fallback_' }, ...children);
      style = `animation: mfm-rainbow ${time(args.speed, '1s')} linear infinite; animation-delay: ${delay};`;
      break;
    }
    case 'font': {
      const family = ['serif', 'monospace', 'cursive', 'fantasy', 'emoji', 'math'].find(key => args[key]);
      if (family) style = `font-family: ${family};`;
      break;
    }
    case 'spin': {
      const direction = args.left ? 'reverse' : args.alternate ? 'alternate' : 'normal';
      const animation = args.x ? 'mfm-spinX' : args.y ? 'mfm-spinY' : 'mfm-spin';
      style = useAnim ? `animation: ${animation} ${time(args.speed, '1.5s')} linear infinite; animation-direction: ${direction}; animation-delay: ${delay};` : '';
      break;
    }
    case 'jump': style = useAnim ? `animation: mfm-jump ${time(args.speed, '0.75s')} linear infinite; animation-delay: ${delay};` : ''; break;
    case 'bounce': style = useAnim ? `animation: mfm-bounce ${time(args.speed, '0.75s')} linear infinite; transform-origin: center bottom; animation-delay: ${delay};` : ''; break;
    case 'flip': style = `transform: ${args.h && args.v ? 'scale(-1, -1)' : args.v ? 'scaleY(-1)' : 'scaleX(-1)'};`; break;
    case 'rotate': style = `transform: rotate(${number(args.deg, 90)}deg); transform-origin: center center;`; break;
    case 'position': if (advancedMfm) style = `transform: translateX(${number(args.x, 0)}em) translateY(${number(args.y, 0)}em);`; break;
    case 'scale': style = advancedMfm ? `transform: scale(${Math.min(number(args.x, 1), 5)}, ${Math.min(number(args.y, 1), 5)});` : ''; break;
    case 'fg': style = `color: #${color(args.color) ?? 'f00'}; overflow-wrap: anywhere;`; break;
    case 'bg': style = `background-color: #${color(args.color) ?? 'f00'}; overflow-wrap: anywhere;`; break;
    case 'border': {
      const borderStyle = ['hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset'].includes(args.style) ? args.style : 'solid';
      style = `border: ${number(args.width, 1)}px ${borderStyle} ${color(args.color) ? `#${color(args.color)}` : 'var(--MI_THEME-accent)'}; border-radius: ${number(args.radius, 0)}px;${args.noclip ? '' : ' overflow: clip;'}`;
      break;
    }
  }
  // Other functions retain their original syntax until implemented.
  if (style === undefined) return mfm.toString([node]);
  return Element('span', { style: `display: inline-block; ${style}` }, ...children);
}

function linkInfo(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const self = url.origin === window.location.origin;
    return { url, self, href: self ? url.pathname + url.search + url.hash : raw };
  } catch { return null; }
}

function renderLink(node, children) {
  const info = linkInfo(node.props.url);
  if (!info) return mfm.toString([node]);
  const attrs = { class: '_link mfm-link', href: info.href, rel: 'nofollow noopener', title: node.props.url, ...(info.self ? {} : { target: '_blank' }) };
  return Element('a', attrs, ...children, ...(info.self ? [] : [Element('i', { class: 'ti ti-external-link mfm-link-icon' })]));
}

function renderMention(node, author) {
  const localHost = window.location.host;
  const host = node.props.host ?? author?.host ?? localHost;
  const remote = host !== localHost;
  const name = node.props.username;
  const canonical = `@${name}${remote ? `@${toUnicode(host)}` : ''}`;
  return Element('a', { class: 'mfm-mention', href: `/${canonical}` },
    Element('img', { class: 'mfm-mention-icon', src: `/avatar/@${name}@${host}`, alt: '' }),
    Element('span', null, Element('span', null, `@${name}`), ...(remote ? [Element('span', { class: 'mfm-mention-host' }, `@${toUnicode(host)}`)] : [])));
}

// A native view-graph renderer, deliberately not an HTML string: note text is
// untrusted. Unsupported MFM is retained as source instead of disappearing.
export function renderMfm(text, { plain = false, nowrap = false, isNote = true, advancedMfm = true, animatedMfm = true, author = null } = {}) {
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
      case 'mention': return renderMention(node, author);
      case 'link': return renderLink(node, children());
      case 'url': return renderLink(node, [node.props.url]);
      case 'fn': return renderFunction(node, children(), advancedMfm, animatedMfm);
      default: return mfm.toString([node]);
    }
  };
  return Element('span', { style: nowrap ? 'white-space:pre;word-wrap:normal;overflow:hidden;text-overflow:ellipsis;' : 'white-space:pre-wrap;' }, ...nodes.flatMap(render));
}
