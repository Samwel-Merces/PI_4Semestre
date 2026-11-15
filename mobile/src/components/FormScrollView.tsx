import type { ReactNode } from 'react';

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface FormScrollViewProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/*
 * Contêiner de formulário que mantém o campo focado e o botão principal
 * acima do teclado. O KeyboardAvoidingView calcula apenas a sobreposição
 * real do teclado, então "padding" funciona no iOS e no Android
 * (edge-to-edge); na web o navegador cuida da rolagem.
 * O conteúdo rola, sem altura fixa, para suportar fonte ampliada.
 */
export default function FormScrollView({
  children,
  contentContainerStyle,
}: FormScrollViewProps) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.grow, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  grow: {
    flexGrow: 1,
  },
});
