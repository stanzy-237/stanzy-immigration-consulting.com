import type { QueryClient, QueryKey } from '@tanstack/react-query';

/** A list item the server hasn't confirmed yet: its id until the refetch brings the real one. */
export const optimisticId = () => `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const isOptimistic = (item: { id: string }) => item.id.startsWith('optimistic-');

/**
 * Mutation options that change cached data at once (`apply`), before the
 * server answers: the page reacts on the tap. A refusal puts the data back
 * as it was; either way it is refetched once the server has answered.
 * Spread into `trpc.x.mutationOptions({ ...optimisticUpdate(...) })`; the
 * component's own `onSuccess` / `onError` (toasts) still run. Does nothing
 * while the data isn't cached.
 */
export function optimisticUpdate<Data, Input>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  apply: (data: Data, input: Input) => Data,
) {
  return {
    onMutate: async (input: Input) => {
      // A refetch landing now would overwrite the optimistic data.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Data>(queryKey);
      if (previous !== undefined) queryClient.setQueryData<Data>(queryKey, apply(previous, input));
      return { previous };
    },
    onError: (_error: unknown, _input: Input, context: { previous?: Data } | undefined) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  };
}

/** `optimisticUpdate` for a cached list (an empty one when nothing is cached yet). */
export function optimisticList<Item, Input>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  apply: (list: Item[], input: Input) => Item[],
) {
  const options = optimisticUpdate<Item[], Input>(queryClient, queryKey, apply);
  return {
    ...options,
    onMutate: async (input: Input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Item[]>(queryKey);
      queryClient.setQueryData<Item[]>(queryKey, (list) => apply(list ?? [], input));
      return { previous };
    },
  };
}
