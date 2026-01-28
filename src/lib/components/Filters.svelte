<script lang="ts">
	import { ConnectedButtons, Button } from 'm3-svelte';

	let {
		items = [],
		sortOptions = [],
		initialSortKey,
		initialDescending = false,
		onChange,
		align = 'center',
		idPrefix = 'filters'
	} = $props<{
		items?: any[];
		sortOptions?: { key: string; label: string }[];
		initialSortKey?: string;
		initialDescending?: boolean;
		onChange?: (payload: { sorted: any[]; sortKey: string; descending: boolean }) => void;
		align?: 'center' | 'left';
		idPrefix?: string;
	}>();

	initialSortKey ??= sortOptions[0]?.key ?? '';

	let sortKey = $state(initialSortKey);
	let descending = $state(initialDescending);
	let searchQuery = $state('');
	let searchOpen = $state(false);
	let searchInput: HTMLInputElement;

	let searchableKeys = $derived(sortOptions.map((o: { key: string; label: string }) => o.key));

	let filtered = $derived.by(() => {
		if (!searchQuery.trim()) return items;
		const query = searchQuery.toLowerCase();
		return items.filter((item: Record<string, unknown>) =>
			searchableKeys.some((key: string) => {
				const val = item[key];
				if (val == null) return false;
				return String(val).toLowerCase().includes(query);
			})
		);
	});

	let sorted = $derived.by(() => {
		const list = [...filtered];
		list.sort((a, b) => {
			const aVal = a[sortKey] as unknown as string | number | undefined;
			const bVal = b[sortKey] as unknown as string | number | undefined;
			let cmp = 0;
			if (typeof aVal === 'string' && typeof bVal === 'string') {
				cmp = aVal.localeCompare(bVal);
			} else {
				cmp = Number(aVal ?? 0) - Number(bVal ?? 0);
			}
			return descending ? -cmp : cmp;
		});
		return list;
	});

	$effect(() => {
		onChange?.({ sorted, sortKey, descending });
	});

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			searchOpen = !searchOpen;
			if (searchOpen) {
				setTimeout(() => searchInput?.focus(), 50);
			} else {
				searchQuery = '';
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class={`mt-5 flex w-full flex-col-reverse items-center gap-4 md:grid md:gap-0 ${align === 'left' ? 'md:grid-cols-[auto_1fr_auto]' : 'md:grid-cols-[1fr_auto_1fr]'}`}
>
	<div
		class={`flex w-full items-center overflow-hidden ${align === 'left' ? 'md:col-start-1 md:justify-start' : 'md:col-start-2 md:justify-center'}`}
	>
		<div class="mr-2 shrink-0 pl-4 md:pl-0">
			<input
				class="hidden"
				id={`flip-order-${idPrefix}`}
				type="checkbox"
				bind:checked={descending}
			/>
			<Button for={`flip-order-${idPrefix}`} square variant="filled" iconType="full">
				<svg
					class="transition-transform duration-300 ease-in-out"
					class:rotate-180={descending}
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					><path
						fill="currentColor"
						d="M9 13q-.425 0-.712-.288T8 12V5.825L6.125 7.7q-.275.275-.687.275T4.725 7.7q-.3-.3-.3-.712t.3-.713L8.3 2.7q.15-.15.325-.213T9 2.425t.375.062t.325.213l3.6 3.6q.3.3.287.7t-.312.7q-.3.275-.7.288t-.7-.288L10 5.825V12q0 .425-.288.713T9 13m6 8.575q-.2 0-.375-.062T14.3 21.3l-3.6-3.6q-.3-.3-.287-.7t.312-.7q.3-.275.7-.288t.7.288L14 18.175V12q0-.425.288-.712T15 11t.713.288T16 12v6.175l1.875-1.875q.275-.275.688-.275t.712.275q.3.3.3.713t-.3.712L15.7 21.3q-.15.15-.325.213t-.375.062"
					/></svg
				>
			</Button>
		</div>
		<div class="no-scrollbar w-full overflow-x-auto pr-4 pb-1 md:pr-0">
			<ConnectedButtons>
				{#each sortOptions as option}
					<input
						id={`sort-${idPrefix}-${option.key}`}
						type="radio"
						name={`sortKey-${idPrefix}`}
						value={option.key}
						bind:group={sortKey}
					/>
					<Button for={`sort-${idPrefix}-${option.key}`} variant="tonal">
						<div class="flex flex-row whitespace-nowrap">
							<p>{option.label}</p>
						</div>
					</Button>
				{/each}
			</ConnectedButtons>
		</div>
	</div>
	<div
		class={`mr-4 flex w-full items-center justify-end md:mr-10 md:w-auto ${align === 'left' ? 'md:col-start-3' : 'md:col-start-3'}`}
	>
		<div class="flex items-center">
			<div
				class="mr-2 overflow-hidden transition-all duration-300 ease-out"
				class:w-0={!searchOpen}
				class:w-full={searchOpen}
				class:md:w-48={searchOpen}
				class:opacity-0={!searchOpen}
				class:opacity-100={searchOpen}
			>
				<input
					bind:this={searchInput}
					type="text"
					placeholder="Search..."
					bind:value={searchQuery}
					class="border-outline/50 bg-surface-container text-on-surface placeholder:text-on-surface-variant/60 mr-2 h-10 w-full rounded-full border px-4 text-sm outline-none"
				/>
			</div>
			<Button
				iconType="full"
				square
				variant={searchOpen ? 'filled' : 'outlined'}
				onclick={() => {
					searchOpen = !searchOpen;
					if (searchOpen) {
						setTimeout(() => searchInput?.focus(), 50);
					} else {
						searchQuery = '';
					}
				}}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					class="transition-transform duration-200"
					class:scale-90={searchOpen}
				>
					<path
						fill="currentColor"
						d="M9.5 16q-2.725 0-4.612-1.888T3 9.5t1.888-4.612T9.5 3t4.613 1.888T16 9.5q0 1.1-.35 2.075T14.7 13.3l5.6 5.6q.275.275.275.7t-.275.7t-.7.275t-.7-.275l-5.6-5.6q-.75.6-1.725.95T9.5 16m0-2q1.875 0 3.188-1.312T14 9.5t-1.312-3.187T9.5 5T6.313 6.313T5 9.5t1.313 3.188T9.5 14"
					/>
				</svg>
			</Button>
		</div>
	</div>
</div>
