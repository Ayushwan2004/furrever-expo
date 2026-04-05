import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator, Keyboard, Animated
} from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
// components/BellaChatbot.tsx
import { sendMessageToChatbot, ConversationMessage } from '../services/chatbotService';
import { CHAT_CONFIG } from '../config/chatbot';

const C = {
  primary:      '#FF8A65',
  primarySoft:  '#FFCCBC',
  background:   '#FFFFFF',
  bgSecondary:  '#F9FAFB',
  border:       '#E5E7EB',
  textPrim:     '#1F2937',
  textMuted:    '#9CA3AF',
  white:        '#FFFFFF',
};

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  time: string;
}

// ─── Shared Icon Component ────────────────────────────────────────────────────
const BellaIcon: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Circle cx="28" cy="30" r="20" fill="#FFE0B2" />
      <Path d="M 12 18 Q 6 10 16 12 Z" fill="#FFB74D" />
      <Path d="M 44 18 Q 50 10 40 12 Z" fill="#FFB74D" />
      <Circle cx="21" cy="26" r="3" fill="#424242" />
      <Circle cx="35" cy="26" r="3" fill="#424242" />
      <Ellipse cx="28" cy="35" rx="8" ry="6" fill="#FFF3E0" />
      <Circle cx="28" cy="33" r="2.5" fill="#424242" />
      <Path d="M 24 37 Q 28 41 32 37" stroke="#424242" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </Svg>
  </View>
);

// ─── Bold Text Parser ─────────────────────────────────────────────────────────
const renderFormattedText = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={index} style={{ fontWeight: '900', color: '#000' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={index}>{part}</Text>;
  });
};

const TypingIndicator = () => (
  <View style={styles.typingRow}>
    <View style={styles.miniAvatar}><BellaIcon size={20} /></View>
    <View style={styles.typingBubble}>
      <ActivityIndicator size="small" color={C.textMuted} />
    </View>
  </View>
);

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowBot]}>
      {!isUser && <View style={styles.miniAvatar}><BellaIcon size={20} /></View>}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.bubbleText, isUser ? styles.textUser : styles.textBot]}>
          {renderFormattedText(message.text)}
        </Text>
        <Text style={[styles.bubbleTime, isUser ? styles.timeUser : styles.timeBot]}>
          {message.time}
        </Text>
      </View>
    </View>
  );
};

const BellaChatbot: React.FC = () => {
  const [isOpen, setIsOpen]     = useState(false);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [history, setHistory]   = useState<ConversationMessage[]>([]);

  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const flatRef = useRef<FlatList<Message>>(null);

  const [messages, setMsgs] = useState<Message[]>(() => {
    const d = new Date();
    const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return [
      { id: 'w1', role: 'bot', time: t, text: '**Hi Hooman! Woof!** 🐾 What do you want to know about me and my friends?' },
      { id: 'w2', role: 'bot', time: t, text: 'Dealing with **health issues** or **anxiety** in your pet?' },
      { id: 'w3', role: 'bot', time: t, text: "I can share **healthy recipes** and diet tips too! 🦴" }
    ];
  });

  useEffect(() => {
    // Tooltip animation on load
    Animated.spring(tooltipAnim, {
      toValue: 1,
      tension: 40,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  const getTime = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  };

  const openChat = () => setIsOpen(true);
  const closeChat = () => {
    Keyboard.dismiss();
    setIsOpen(false);
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    Keyboard.dismiss();
    setInput('');

    // 1. Add User Message to UI
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, time: getTime() };
    setMsgs(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // 2. Format history to match the new 'content' and 'assistant' structure
      // We only send real chat history, not the initial welcome messages
      const formattedHistory: ConversationMessage[] = history;

      const reply = await sendMessageToChatbot(formattedHistory, text);

      // 3. Add Bot Message to UI
      setMsgs(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'bot', 
        text: reply, 
        time: getTime() 
      }]);

      // 4. Update History using the new structure { role: 'user' | 'assistant', content: string }
      setHistory(prev => {
        const updated: ConversationMessage[] = [
          ...prev, 
          { role: 'user', content: text }, 
          { role: 'assistant', content: reply }
        ];
        return updated.slice(-CHAT_CONFIG.maxConversationHistory);
      });

    } catch (error) {
      setMsgs(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'bot', 
        time: getTime(), 
        text: 'Oops, **connection dropped** 🐾 Try again?' 
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, history, loading]);

  useEffect(() => {
    if (messages.length > 0 && isOpen) {
      const t = setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      return () => clearTimeout(t);
    }
  }, [messages, loading, isOpen]);

  return (
    <>
      {!isOpen && (
        <View style={styles.fabContainer}>
          <Animated.View style={[styles.tooltip, { opacity: tooltipAnim, transform: [{ scale: tooltipAnim }] }]}>
            <Text style={styles.tooltipText}>Hey Hooman, I'm Bella 👋</Text>
            <View style={styles.tooltipArrow} />
          </Animated.View>
          <TouchableOpacity onPress={openChat} activeOpacity={0.8} style={styles.fabTouchable}>
            <View style={styles.fabInner}>
              <BellaIcon size={46} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={closeChat}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeChat} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardWrapper}>
            <View style={styles.dialogCard}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderLeft}>
                  <View style={styles.sheetAvatar}><BellaIcon size={32} /></View>
                  <View>
                    <Text style={styles.sheetName}>Bella AI</Text>
                    <Text style={styles.sheetSub}>Your Pet Companion</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={closeChat} style={styles.closeBtn}>
                  <Text style={styles.closeBtnTxt}>✕</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                ref={flatRef}
                data={messages}
                keyExtractor={i => i.id}
                renderItem={({ item }) => <MessageBubble message={item} />}
                contentContainerStyle={styles.msgList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListFooterComponent={loading ? <TypingIndicator /> : null}
              />

              <View style={styles.inputBar}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Reply to Bella..."
                  placeholderTextColor={C.textMuted}
                  multiline
                  maxLength={500}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  onSubmitEditing={send}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnOff]}
                  onPress={send}
                  disabled={!input.trim() || loading}
                  activeOpacity={0.8}
                >
                  {loading ? <ActivityIndicator size="small" color={C.white} /> : <Text style={styles.sendArrow}>↑</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
};

export default BellaChatbot;

const styles = StyleSheet.create({
  fabContainer: { position: 'absolute', bottom: 100, right: 10, alignItems: 'center' },
  tooltip: { backgroundColor: C.textPrim, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 5 },
  tooltipText: { color: C.white, fontSize: 12, fontWeight: '700' },
  tooltipArrow: { position: 'absolute', bottom: -4, right: 20, width: 10, height: 10, backgroundColor: C.textPrim, transform: [{ rotate: '45deg' }] },
  fabTouchable: { zIndex: 9999 },
  fabInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.primarySoft, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  keyboardWrapper: { width: '100%', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 16 },
  dialogCard: { width: '100%', maxHeight: '85%', backgroundColor: C.background, borderRadius: 24, overflow: 'hidden', elevation: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.white },
  sheetHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.bgSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: C.primarySoft },
  sheetName: { fontSize: 16, fontWeight: '800', color: C.textPrim },
  sheetSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  closeBtnTxt: { color: C.textMuted, fontSize: 13, fontWeight: '800' },
  msgList: { padding: 16, paddingBottom: 8 },
  bubbleRow: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-end' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowBot: { justifyContent: 'flex-start' },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.bgSecondary, justifyContent: 'center', alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: C.border },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12 },
  bubbleUser: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: C.bgSecondary, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  textUser: { color: C.white, fontWeight: '500' },
  textBot: { color: C.textPrim },
  bubbleTime: { fontSize: 10, marginTop: 5 },
  timeUser: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  timeBot: { color: C.textMuted },
  typingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  typingBubble: { flexDirection: 'row', backgroundColor: C.bgSecondary, borderRadius: 18, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border, padding: 12, paddingHorizontal: 16, alignItems: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  input: { flex: 1, backgroundColor: C.bgSecondary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.textPrim, maxHeight: 100, borderWidth: 1, borderColor: C.border },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnOff: { backgroundColor: C.border },
  sendArrow: { color: C.white, fontSize: 20, fontWeight: '900' },
});