/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Mirrors getRenoteMenu in packages/frontend/src/utility/get-note-menu.ts.
// Items: { type: 'divider' } | { text, icon, action() } | { text, icon, children() -> items }.
// services: api.post, toast(text), notePosted(note), quote({ renote, channel }), favoritedChannels(),
//   config { rememberNoteVisibility, visibility, localOnly, defaultNoteVisibility, defaultNoteLocalOnly },
//   labels { renote, quote, inChannelRenote, inChannelQuote, renoteToChannel, renoteToOtherChannel, renoted, renotedToX(name) }.
export function smallerVisibility(a, b) {
  if (a === 'specified' || b === 'specified') return 'specified';
  if (a === 'followers' || b === 'followers') return 'followers';
  if (a === 'home' || b === 'home') return 'home';
  return 'public';
}

export function getRenoteMenu({ note, services }) {
  const appear = note.renote && note.text == null && !(note.fileIds?.length) ? note.renote : note;
  const { labels, config } = services;
  const create = async (body, toast) => {
    const res = await services.api.post('notes/create', body);
    services.toast(toast);
    services.notePosted(res.createdNote);
  };

  const channelItems = [];
  const normalItems = [];
  const externalItems = [];

  if (appear.channel) {
    channelItems.push(
      { text: labels.inChannelRenote, icon: 'ti ti-repeat', action: () => create({ renoteId: appear.id, channelId: appear.channelId }, labels.renoted) },
      { text: labels.inChannelQuote, icon: 'ti ti-quote', action: () => services.quote({ renote: appear, channel: appear.channel }) },
    );
  }

  if (!appear.channel || appear.channel.allowRenoteToExternal) {
    normalItems.push({
      text: labels.renote,
      icon: 'ti ti-repeat',
      action: () => {
        const remember = config.rememberNoteVisibility;
        const localOnly = remember ? config.localOnly : config.defaultNoteLocalOnly;
        let visibility = smallerVisibility(appear.visibility, remember ? config.visibility : config.defaultNoteVisibility);
        if (appear.channel?.isSensitive) visibility = smallerVisibility(visibility, 'home');
        return create({ localOnly, visibility, renoteId: appear.id }, labels.renoted);
      },
    }, { text: labels.quote, icon: 'ti ti-quote', action: () => services.quote({ renote: appear }) });

    externalItems.push({
      text: appear.channel ? labels.renoteToOtherChannel : labels.renoteToChannel,
      icon: 'ti ti-repeat',
      children: async () => (await services.favoritedChannels())
        .filter(c => !appear.channelId || c.id !== appear.channelId)
        .map(c => ({ text: c.name, action: () => create({ renoteId: appear.id, channelId: c.id }, labels.renotedToX(c.name)) })),
    });
  }

  return [
    ...normalItems,
    ...(channelItems.length > 0 && normalItems.length > 0 ? [{ type: 'divider' }] : []),
    ...channelItems,
    ...(externalItems.length > 0 && (normalItems.length > 0 || channelItems.length > 0) ? [{ type: 'divider' }] : []),
    ...externalItems,
  ];
}
