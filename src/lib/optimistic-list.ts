import type { QueryClient, QueryKey } from '@tanstack/react-query';

/** A list item the server hasn't confirmed yet: its id until the refetch brings the real one. */
export const optimisticId = () => `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const isOptimistic = (item: { id: string }) => item.id.startsWith('optimistic-');

/**
 * Mutation options that change a cached list at once (`apply`), before the
 * server answers: the page reacts on the tap. A refusal puts the list back
 * as it was; either way the list is refetched once the server has answered.
 * Spread into `trpc.x.mutationOptions({ ...optimisticList(...) })`; the
 * component's own `onSuccess` / `onError` (toasts) still run.
 */
export function optimisticList<Item, Input>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  apply: (list: Item[], input: Input) => Item[],
) {
  return {
    onMutate: async (input: Input) => {
      // A refetch landing now would overwrite the optimistic list.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Item[]>(queryKey);
      queryClient.setQueryData<Item[]>(queryKey, (list) => apply(list ?? [], input));
      return { previous };
    },
    onError: (_error: unknown, _input: Input, context: { previous?: Item[] } | undefined) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  };
}
