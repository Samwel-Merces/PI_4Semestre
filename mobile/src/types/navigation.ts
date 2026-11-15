export type AuthStackParamList = {
  /*
   * Ao voltar do cadastro ou da redefinição de senha, o login recebe
   * o e-mail para preencher o campo e a mensagem de sucesso.
   */
  Login: {
    email?: string;
    successMessage?: string;
  } | undefined;

  Register: undefined;
  ForgotPassword: undefined;

  ResetPassword: {
    token: string;
  };
};

export type ClientStackParamList = {
  ClientHome: undefined;

  ProductDetails: {
    productId: string;
  };

  Cart: undefined;
  Checkout: undefined;
  Orders: undefined;

  OrderDetails: {
    orderId: string;
  };

  Pets: undefined;

  PetForm: {
    petId?: string;
  } | undefined;

  Services: undefined;

  BookAppointment: {
    serviceId: string;
  };

  Appointments: undefined;
  Profile: undefined;
  EditProfile: undefined;
};

export type AdminStackParamList = {
  AdminHome: undefined;
  AdminProducts: undefined;
  CreateProduct: undefined;

  EditProduct: {
    productId: string;
  };

  AdminOrders: undefined;

  AdminOrderDetails: {
    orderId: string;
  };

  AdminServices: undefined;

  ServiceForm: {
    serviceId?: string;
  } | undefined;

  AdminAgenda: undefined;
};