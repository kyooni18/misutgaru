/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Mirrors post()/canPost in packages/frontend/src/components/MkPostForm.vue.
// Keys whose value is undefined are dropped by JSON.stringify, as in Vue's request body.
export function appendHashtags(text, hashtags) {
  const tags = hashtags.trim().split(' ').map(x => (x.startsWith('#') ? x : '#' + x)).join(' ');
  if (!text) return tags;
  const lines = text.split('\n');
  lines[lines.length - 1] += lines[lines.length - 1].trim() === '' ? tags : ' ' + tags;
  return lines.join('\n');
}

export function buildPostPayload(f) {
  const data = {
    text: f.text === '' ? null : f.text,
    fileIds: f.files?.length > 0 ? f.files.map(x => x.id) : undefined,
    replyId: f.reply ? f.reply.id : undefined,
    renoteId: f.renote ? f.renote.id : f.quoteId ? f.quoteId : undefined,
    channelId: f.channel ? f.channel.id : undefined,
    poll: f.poll ?? null,
    cw: f.useCw ? f.cw ?? '' : null,
    localOnly: f.visibility === 'specified' ? false : !!f.localOnly,
    visibility: f.visibility,
    visibleUserIds: f.visibility === 'specified' ? (f.visibleUsers ?? []).map(u => u.id) : undefined,
    reactionAcceptance: f.reactionAcceptance ?? null,
  };
  if (f.withHashtags && f.hashtags && f.hashtags.trim() !== '') data.text = appendHashtags(data.text, f.hashtags);
  return data;
}

export function canPost(f) {
  const len = (f.text ?? '').length;
  const fileCount = f.files?.length ?? 0;
  return !f.posting
    && (len >= 1 || fileCount >= 1 || f.poll != null || f.renote != null || f.quoteId != null)
    && len <= (f.maxTextLength ?? 1000)
    && (f.useCw ? f.cw != null && f.cw.trim() !== '' && f.cw.length <= 100 : true)
    && fileCount <= 16
    && (!f.poll || f.poll.choices.length >= 2);
}
