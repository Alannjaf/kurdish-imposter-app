// ChatPanel — translucent bottom sheet text chat used across all online phases.
//
// Behavior:
//   - Closed: small "Chat (N)" tab anchored to the bottom; tapping opens.
//   - Open: bottom-half overlay with last 100 messages + input bar.
//   - Input is capped at CHAT_MAX_LEN (240) and dispatches `{ type: 'chat', text }`.
//   - Auto-scrolls to newest on open + on each new message.
//   - Translucent background so the screen behind stays visible (NOT a Modal).
//   - Closed-state tab uses `pointerEvents="box-none"` on its wrapper so taps
//     on screen content elsewhere keep flowing.
//
// i18n keys used:
//   multiplayer.chat.title
//   multiplayer.chat.placeholder
//   multiplayer.chat.send
//   multiplayer.chat.empty
//   multiplayer.chat.open
//   multiplayer.chat.close
//   multiplayer.chat.you

import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { fonts, useThemeColors } from '../../theme';
import { useLocale, useT } from '../../i18n';
import { CHAT_MAX_LEN, C2S } from '../protocol';
import type { ChatMessage } from '../__stub_usePartyRoom';

type Props = {
  chat: ChatMessage[];
  send: (msg: C2S) => void;
  /** Seat of the local player — used to highlight "you" bubbles. */
  mySeat?: number | null;
};

export function ChatPanel({ chat, send, mySeat }: Props) {
  const t = useT();
  const colors = useThemeColors();
  const { locale, isRTL } = useLocale();
  const { height: viewportHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);
  // Percent heights don't resolve cleanly inside KeyboardAvoidingView on web —
  // compute an explicit pixel height so the panel reliably gets ~70% of viewport.
  const panelHeight = Math.floor(viewportHeight * 0.7);

  // Keep view pinned to the latest message.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 30);
    return () => clearTimeout(id);
  }, [chat.length, open]);

  const onSend = () => {
    const trimmed = text.trim().slice(0, CHAT_MAX_LEN);
    if (!trimmed) return;
    send({ type: 'chat', text: trimmed });
    setText('');
  };

  const visible = chat.slice(-100);
  const family = locale === 'en' ? fonts.ui : fonts.arabicUI;

  // Closed-state floating chat tab. Wrapper is transparent + box-none so it
  // never blocks the screen behind.
  if (!open) {
    return (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          paddingBottom: 14,
        }}
      >
        <TouchableOpacity
          onPress={() => setOpen(true)}
          activeOpacity={0.85}
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 999,
            backgroundColor: colors.ink,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 6,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 14, color: colors.bg, fontFamily: family, fontWeight: '700' }}>
            {t('multiplayer.chat.open')}
          </Text>
          {chat.length > 0 ? (
            <View
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: 11,
                paddingHorizontal: 6,
                backgroundColor: colors.pomegranate,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                {chat.length > 99 ? '99+' : String(chat.length)}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      }}
    >
      {/* Translucent scrim — taps close the panel, but it's only on the upper
          portion so the screen behind remains visible. */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setOpen(false)}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.18)' }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderTopWidth: 1,
            borderColor: colors.line,
            // Explicit pixel height (~70% of viewport) so the message list
            // always has room to scroll, even with one or two messages, and
            // so percent-height issues inside KAV don't collapse the panel.
            height: panelHeight,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: -3 },
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 18,
              paddingTop: 14,
              paddingBottom: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}
          >
            <Text
              style={{
                color: colors.ink,
                fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
                fontWeight: '800',
                fontSize: 18,
              }}
            >
              {t('multiplayer.chat.title')}
            </Text>
            <TouchableOpacity
              onPress={() => setOpen(false)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: colors.bgElev,
              }}
            >
              <Text style={{ color: colors.ink2, fontSize: 13, fontFamily: family, fontWeight: '600' }}>
                {t('multiplayer.chat.close')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView
            ref={(r) => {
              scrollRef.current = r;
            }}
            style={{ flex: 1, paddingHorizontal: 14 }}
            contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
          >
            {visible.length === 0 ? (
              <Text
                style={{
                  textAlign: 'center',
                  paddingVertical: 24,
                  color: colors.ink3,
                  fontFamily: family,
                  fontSize: 14,
                }}
              >
                {t('multiplayer.chat.empty')}
              </Text>
            ) : (
              visible.map((m, i) => {
                const isMine = mySeat != null && m.fromSeat === mySeat;
                return (
                  <View
                    key={`${m.ts}-${i}`}
                    style={{
                      alignSelf: isMine
                        ? isRTL
                          ? 'flex-start'
                          : 'flex-end'
                        : isRTL
                          ? 'flex-end'
                          : 'flex-start',
                      maxWidth: '82%',
                      backgroundColor: isMine ? colors.pomegranate : colors.bgElev,
                      borderRadius: 14,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: isMine ? 'rgba(255,255,255,0.85)' : colors.ink3,
                        marginBottom: 2,
                        fontFamily: family,
                      }}
                    >
                      {isMine ? t('multiplayer.chat.you') : m.fromName}
                    </Text>
                    <Text
                      style={{
                        fontSize: 15,
                        color: isMine ? '#FFFFFF' : colors.ink,
                        fontFamily: family,
                        lineHeight: 20,
                      }}
                    >
                      {m.text}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Input bar */}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              borderTopWidth: 1,
              borderTopColor: colors.line,
            }}
          >
            <TextInput
              value={text}
              onChangeText={(t2) => setText(t2.slice(0, CHAT_MAX_LEN))}
              placeholder={t('multiplayer.chat.placeholder')}
              placeholderTextColor={colors.ink3}
              maxLength={CHAT_MAX_LEN}
              onSubmitEditing={onSend}
              returnKeyType="send"
              style={{
                flex: 1,
                fontSize: 15,
                color: colors.ink,
                backgroundColor: colors.bgElev,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontFamily: family,
                textAlign: isRTL ? 'right' : 'left',
              }}
            />
            <TouchableOpacity
              onPress={onSend}
              disabled={text.trim().length === 0}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor:
                  text.trim().length === 0 ? colors.bgElev : colors.pomegranate,
              }}
            >
              <Text
                style={{
                  color: text.trim().length === 0 ? colors.ink3 : '#FFFFFF',
                  fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
                  fontWeight: '700',
                  fontSize: 14,
                }}
              >
                {t('multiplayer.chat.send')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default ChatPanel;
