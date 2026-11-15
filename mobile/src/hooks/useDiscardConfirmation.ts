import { useCallback, useRef } from 'react';

import {
  useNavigation,
  usePreventRemove,
} from '@react-navigation/native';

import { confirmAction } from '../utils/confirm';

/*
 * Pede confirmação antes de sair de um formulário modificado
 * (botão Voltar, gesto de voltar e botão físico do Android).
 * Formulários sem alteração saem direto.
 * Depois de salvar com sucesso, chame allowLeave() antes de navegar.
 */
export function useDiscardConfirmation(isDirty: boolean) {
  const navigation = useNavigation();
  const leaveAllowed = useRef(false);

  usePreventRemove(isDirty, ({ data }) => {
    if (leaveAllowed.current) {
      navigation.dispatch(data.action);
      return;
    }

    void confirmAction({
      title: 'Descartar alterações?',
      message: 'Os dados preenchidos neste formulário serão perdidos.',
      confirmText: 'Descartar',
      cancelText: 'Continuar editando',
      destructive: true,
    }).then((confirmed) => {
      if (confirmed) {
        navigation.dispatch(data.action);
      }
    });
  });

  const allowLeave = useCallback((): void => {
    leaveAllowed.current = true;
  }, []);

  return { allowLeave };
}
