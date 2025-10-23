<script lang="ts">
	import '../app.css';
	import '../main.css';
	import SideBar from '$lib/components/SideBar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import { Toaster } from 'svelte-sonner';
    import { UserInfo, isLoggedIn } from '$lib/store';

	let { children, data } = $props();
    $effect(() => {
		console.log(data?.user);
        isLoggedIn.set(Boolean(data?.user));
        UserInfo.set(data?.user ?? null);
	});
</script>

<TopBar />
<SideBar />
<div class="fixed inset-0 left-23 top-14 bottom-30 overflow-y-auto overflow-x-hidden">
	<div>
		{@render children()}
	</div>
</div>
<BottomBar />
<Toaster />