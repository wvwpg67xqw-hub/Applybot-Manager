import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  const queryClient = useQueryClient();
  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), null);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
    },
  });

  const login = (redirect = window.location.pathname) => {
    window.location.href = `/api/auth/discord?redirect=${encodeURIComponent(redirect)}`;
  };

  const logout = () => logoutMutation.mutate();

  return {
    user: user ?? null,
    isLoading: isLoading && !isError,
    isAuthenticated: !!user,
    login,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };
}
