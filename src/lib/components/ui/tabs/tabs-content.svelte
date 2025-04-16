<script>
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let className = undefined;
	export { className as class };
	export let value = '';
</script>

<TabsPrimitive.Content
	{value}
	class={cn(
		'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
		className
	)}
	{...$$restProps}
>
	<slot />
</TabsPrimitive.Content>
