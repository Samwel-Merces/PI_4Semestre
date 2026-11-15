import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NavigationContainer } from '@react-navigation/native';

import LoadingIndicator from '../components/LoadingIndicator';
import { useAuth } from '../hooks/useAuth';

import AuthNavigator from './AuthNavigator';
import ClientNavigator from './ClientNavigator';
import AdminNavigator from './AdminNavigator';
import { resolveNavigator } from './resolveNavigator';

function SessionLoadingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo} accessibilityRole="header">
          PETSHOP
        </Text>

        <LoadingIndicator message="Verificando sua sessão..." />
      </View>
    </SafeAreaView>
  );
}

export default function RootNavigator() {
  const {
    user,
    isLoadingSession,
  } = useAuth();

  const navigator = resolveNavigator(
    isLoadingSession,
    user,
  );

  if (navigator === 'loading') {
    return <SessionLoadingScreen />;
  }

  /*
   * Cada perfil tem sua própria pilha. Ao entrar, sair ou perder a sessão,
   * a pilha anterior é desmontada inteira: o botão Voltar nunca retorna ao
   * login depois de autenticar nem à área logada depois do logout.
   */
  return (
    <NavigationContainer>
      {navigator === 'auth' ? (
        <AuthNavigator />
      ) : navigator === 'admin' ? (
        <AdminNavigator />
      ) : (
        <ClientNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 24,
  },

  logo: {
    color: '#2D6CDF',
    fontSize: 32,
    fontWeight: '700',
  },
});