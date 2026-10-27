/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// View model for one notification, mirroring packages/frontend/src/components/MkNotification.vue and
// utility/get-note-summary.ts. labels: { t: { <type text> }, deletedNote, invisibleNote, poll, withNFiles(n), ... } (see test).
export function getNoteSummary(note, labels) {
  if (note == null) return '';
  if (note.deletedAt) return `(${labels.deletedNote})`;
  if (note.isHidden) return `(${labels.invisibleNote})`;
  let s = note.cw != null ? note.cw : note.text ? note.text : '';
  if ((note.files ?? []).length !== 0) s += ` (${labels.withNFiles(note.files.length)})`;
  if (note.poll) s += ` (${labels.poll})`;
  if (note.replyId) s += note.reply ? `\n\nRE: ${getNoteSummary(note.reply, labels)}` : '\n\nRE: ...';
  if (note.renoteId) s += note.renote ? `\n\nRN: ${getNoteSummary(note.renote, labels)}` : '\n\nRN: ...';
  return s.trim();
}

export const userPage = u => `/@${u.username}${u.host ? '@' + u.host : ''}`;
export const notePage = n => `/notes/${n.id}`;

const SUB_ICONS = {
  follow: 'plus', receiveFollowRequest: 'clock', followRequestAccepted: 'check', renote: 'repeat', reply: 'arrow-back-up',
  mention: 'at', quote: 'quote', pollEnded: 'chart-arrows', scheduledNotePosted: 'send', scheduledNotePostFailed: 'alert-triangle',
  achievementEarned: 'medal', exportCompleted: 'archive', login: 'login-2', createToken: 'key', chatRoomInvitationReceived: 'messages',
};
const USER_TYPES = ['follow', 'mention', 'reply', 'renote', 'quote', 'reaction', 'receiveFollowRequest', 'followRequestAccepted'];
const SELF_TYPES = ['roleAssigned', 'achievementEarned', 'exportCompleted', 'login', 'createToken', 'scheduledNotePosted', 'scheduledNotePostFailed'];

export function describeNotification(n, me, labels) {
  const t = labels.t;
  const view = { type: n.type, subIcon: SUB_ICONS[n.type] ?? null, avatar: null, headerText: null, headerUser: null, body: null, href: null, reactions: [], users: [], followRequest: false };

  if (['pollEnded', 'note'].includes(n.type) && n.note) view.avatar = n.note.user;
  else if (SELF_TYPES.includes(n.type)) view.avatar = me;
  else if (n.type === 'reaction:grouped') view.groupIcon = n.note.reactionAcceptance === 'likeOnly' ? 'heart' : 'plus';
  else if (n.type === 'renote:grouped') view.groupIcon = 'repeat';
  else if (n.user) view.avatar = n.user;
  else if (n.icon) view.appIcon = n.icon;
  if (n.type === 'reaction') view.reaction = n.reaction.replace(/^:(\w+):$/, ':$1@.:');
  if (n.type === 'roleAssigned') view.roleIcon = n.role.iconUrl ?? null;

  if (USER_TYPES.includes(n.type)) view.headerUser = n.user;
  else if (n.type === 'note') view.headerText = `${t.newNote}: ${n.note.user.name || n.note.user.username}`;
  else if (n.type === 'exportCompleted') view.headerText = labels.exportOfXCompleted(labels.exportEntityName[n.exportedEntity]);
  else if (n.type === 'reaction:grouped') {
    const count = new Set(n.reactions.map(r => r.user.id)).size;
    view.headerText = n.note.reactionAcceptance === 'likeOnly' ? labels.likedBySomeUsers(count) : labels.reactedBySomeUsers(count);
  } else if (n.type === 'renote:grouped') view.headerText = labels.renotedBySomeUsers(n.users.length);
  else if (n.type === 'app') view.headerText = n.header;
  else view.headerText = t[n.type] ?? null;

  switch (n.type) {
    case 'reaction': case 'reaction:grouped': case 'pollEnded': case 'scheduledNotePosted':
    case 'reply': case 'mention': case 'quote': case 'note':
      view.body = getNoteSummary(n.note, labels); view.href = notePage(n.note); break;
    case 'renote': case 'renote:grouped':
      view.body = getNoteSummary(n.note.renote, labels); view.href = notePage(n.note); break;
    case 'roleAssigned': view.body = n.role.name; break;
    case 'chatRoomInvitationReceived': view.body = n.invitation.room.name; break;
    case 'achievementEarned': view.body = labels.achievementTitle(n.achievement); view.href = '/my/achievements'; break;
    case 'exportCompleted': view.body = labels.showFile; view.href = `/my/drive/file/${n.fileId}`; break;
    case 'createToken': view.body = labels.createTokenDescription; view.href = '/settings/apps'; break;
    case 'follow': view.body = labels.youGotNewFollower; break;
    case 'followRequestAccepted': view.body = labels.followRequestAccepted; view.message = n.message ?? null; break;
    case 'receiveFollowRequest': view.body = labels.receiveFollowRequest; view.followRequest = true; break;
    case 'test': view.body = labels.notificationWillBeDisplayedLikeThis; break;
    case 'app': view.body = n.body; break;
  }
  if (n.type === 'reaction:grouped') view.reactions = n.reactions.map(r => ({ user: r.user, reaction: r.reaction.replace(/^:(\w+):$/, ':$1@.:') }));
  if (n.type === 'renote:grouped') view.users = n.users;
  return view;
}

// following/requests/accept|reject, as in MkNotification.vue.
export function answerFollowRequest(api, notification, accept) {
  if (!notification.user) return null;
  return api.post(accept ? 'following/requests/accept' : 'following/requests/reject', { userId: notification.user.id });
}
