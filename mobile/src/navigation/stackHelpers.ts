import {
  StackActions,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';

import { resolveStackTarget } from './stackTargets';

type RouteWithoutParams<ParamList extends ParamListBase> = {
  [Name in keyof ParamList]: undefined extends ParamList[Name]
    ? Name
    : never;
}[keyof ParamList] &
  string;

export function navigateWithoutDuplicate<
  ParamList extends ParamListBase,
>(
  navigation: NavigationProp<ParamList>,
  name: RouteWithoutParams<ParamList>,
): void {
  const action = resolveStackTarget(
    navigation.getState().routes,
    name,
  );

  navigation.dispatch(
    action === 'popTo'
      ? StackActions.popTo(name)
      : StackActions.replace(name),
  );
}
