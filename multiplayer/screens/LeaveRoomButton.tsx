// LeaveRoomButton — top-left affordance to exit an online room.
//
// Renders the same circular `‹` / `✕` chip the OnlineHome / Join screens use
// so users see a consistent back-out path on every in-room screen. Confirms
// before firing because leaving mid-round impacts everyone else's game.
//
// The actual leave flow lives in RoomShell (sends `{ type: 'leave' }`,
// disconnects, and asks OnlineModeRouter to reset session). This component
// is presentational only.
//
// i18n keys:
//   multiplayer.room.leave_confirm_title
//   multiplayer.room.leave_confirm_body_lobby
//   multiplayer.room.leave_confirm_body_active
//   multiplayer.room.leave_confirm_yes
//   multiplayer.room.leave_confirm_cancel

import React from 'react';
import { Alert, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useThemeColors } from '../../theme';
import { useLocale, useT } from '../../i18n';

export type LeaveRoomMode = 'lobby' | 'active';

type Props = {
  onLeave: () => void;
  /** 'lobby' = no game in progress; 'active' = warn user the round continues. */
  mode?: LeaveRoomMode;
  /** Optional override label shown next to the icon. Defaults to "✕" only. */
  label?: string;
};

export function LeaveRoomButton({ onLeave, mode = 'lobby' }: Props) {
  const t = useT();
  const colors = useThemeColors();
  const { isRTL } = useLocale();

  const ask = () => {
    const title = t('multiplayer.room.leave_confirm_title');
    const body =
      mode === 'active'
        ? t('multiplayer.room.leave_confirm_body_active')
        : t('multiplayer.room.leave_confirm_body_lobby');
    const yes = t('multiplayer.room.leave_confirm_yes');
    const cancel = t('multiplayer.room.leave_confirm_cancel');

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Native confirm dialog reads more naturally than React Native Alert
      // on web (which renders as a non-blocking toast in some RN-Web builds).
      // eslint-disable-next-line no-alert
      if (window.confirm(`${title}\n\n${body}`)) onLeave();
      return;
    }

    Alert.alert(title, body, [
      { text: cancel, style: 'cancel' },
      { text: yes, style: 'destructive', onPress: onLeave },
    ]);
  };

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        marginBottom: 6,
      }}
    >
      <TouchableOpacity
        onPress={ask}
        accessibilityLabel="leave-room"
        style={{
          minWidth: 36,
          height: 36,
          paddingHorizontal: 12,
          borderRadius: 18,
          backgroundColor: colors.bgElev,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 14, color: colors.ink, fontWeight: '700' }}>✕</Text>
        <Text style={{ fontSize: 13, color: colors.ink, fontWeight: '600' }}>
          {t('multiplayer.room.leave')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default LeaveRoomButton;
