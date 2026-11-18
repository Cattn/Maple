<script lang="ts">
	import { Button, Checkbox } from 'm3-svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { toast } from 'svelte-sonner';
	import type { Passkey } from '@better-auth/passkey';
	import { authClient, errorMessage, signOut, verifiedURL, type AuthError } from '$lib/api/auth';
	import { emailSchema, firstIssue, passwordSchema } from '$shared/validation/account';

	const inputClass =
		'bg-surface text-on-surface placeholder:text-on-surface-variant/60 ring-outline-variant focus:ring-primary w-full rounded-xl px-3.5 py-2.5 text-sm ring-1 transition focus:ring-2 focus:outline-none';

	let email = $state('');
	let newEmail = $state('');
	let editingEmail = $state(false);
	let emailStatus = $state('');

	let currentPassword = $state('');
	let newPassword = $state('');
	let signOutOthers = $state(true);
	let editingPassword = $state(false);

	let passkeys = $state<Passkey[]>([]);
	let busy = $state(false);

	let emailIssue = $derived(
		newEmail ? firstIssue(emailSchema.safeParse(newEmail.trim())) : undefined
	);
	let passwordIssue = $derived(
		newPassword ? firstIssue(passwordSchema.safeParse(newPassword)) : undefined
	);

	async function run(action: () => Promise<AuthError>, success: string) {
		busy = true;
		const error = await action();
		busy = false;
		if (error) {
			toast.error(errorMessage(error));
			return false;
		}
		if (success) toast.success(success);
		return true;
	}

	async function loadPasskeys() {
		try {
			const { data } = await authClient.passkey.listUserPasskeys();
			passkeys = data ?? [];
		} catch {
			passkeys = [];
		}
	}

	async function changeEmail(event: SubmitEvent) {
		event.preventDefault();
		const target = newEmail.trim();
		if (!target || emailIssue || busy) return;
		const changed = await run(
			async () =>
				(await authClient.changeEmail({ newEmail: target, callbackURL: verifiedURL() })).error,
			`Confirmation link sent to ${target}.`
		);
		if (changed) {
			emailStatus = `Open the link we sent to ${target} to confirm your new email.`;
			newEmail = '';
			editingEmail = false;
		}
	}

	async function changePassword(event: SubmitEvent) {
		event.preventDefault();
		if (!currentPassword || !newPassword || passwordIssue || busy) return;
		const changed = await run(
			async () =>
				(
					await authClient.changePassword({
						currentPassword,
						newPassword,
						revokeOtherSessions: signOutOthers
					})
				).error,
			'Password updated.'
		);
		if (changed) {
			currentPassword = '';
			newPassword = '';
			editingPassword = false;
		}
	}

	async function addPasskey() {
		if (await run(async () => (await authClient.passkey.addPasskey()).error, 'Passkey added.')) {
			await loadPasskeys();
		}
	}

	async function deletePasskey(id: string) {
		if (
			await run(
				async () => (await authClient.passkey.deletePasskey({ id })).error,
				'Passkey removed.'
			)
		) {
			await loadPasskeys();
		}
	}

	async function leave(everywhere: boolean) {
		if (await run(() => signOut(everywhere), '')) goto(resolve('/login'));
	}

	onMount(async () => {
		try {
			const { data } = await authClient.getSession();
			email = data?.user.email ?? '';
		} catch {
			email = '';
		}
		await loadPasskeys();
	});
</script>

<div class="flex flex-col gap-5">
	<!-- Sign-in & Security -->
	<div
		class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
	>
		<div class="border-outline-variant/40 border-b px-5 py-3.5">
			<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
				Sign-in &amp; security
			</h3>
		</div>

		<div class="divide-outline-variant/40 divide-y">
			<!-- Email row -->
			<div class="flex flex-col gap-3 px-5 py-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="min-w-0 flex-1">
						<p class="text-on-surface text-sm font-semibold">Email address</p>
						<p class="text-on-surface-variant mt-0.5 truncate text-xs">
							{email || 'Not available'}
						</p>
					</div>
					<Button
						variant="tonal"
						onclick={() => {
							editingEmail = !editingEmail;
							if (!editingEmail) newEmail = '';
						}}
						disabled={busy}
					>
						{editingEmail ? 'Cancel' : 'Change'}
					</Button>
				</div>

				{#if emailStatus}
					<p
						class="bg-primary-container/50 text-on-primary-container rounded-xl px-3.5 py-2.5 text-xs"
						role="status"
					>
						{emailStatus}
					</p>
				{/if}

				{#if editingEmail}
					<form
						onsubmit={changeEmail}
						transition:slide={{ duration: 180 }}
						class="bg-surface-container flex flex-col gap-3 rounded-2xl p-4"
					>
						<div class="flex flex-col gap-1.5">
							<label for="new-email" class="text-on-surface-variant text-xs font-semibold"
								>New email address</label
							>
							<input
								id="new-email"
								type="email"
								autocomplete="email"
								placeholder="you@example.com"
								bind:value={newEmail}
								class={inputClass}
							/>
							{#if emailIssue}
								<p class="text-error text-xs">{emailIssue}</p>
							{/if}
						</div>
						<div class="flex flex-wrap justify-end gap-2">
							<Button
								variant="filled"
								type="submit"
								disabled={busy || !newEmail.trim() || !!emailIssue}
							>
								Send confirmation link
							</Button>
						</div>
					</form>
				{/if}
			</div>

			<!-- Password row -->
			<div class="flex flex-col gap-3 px-5 py-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="min-w-0 flex-1">
						<p class="text-on-surface text-sm font-semibold">Password</p>
						<p class="text-on-surface-variant mt-0.5 text-xs">
							Update the password used to sign in to Maple.
						</p>
					</div>
					<Button
						variant="tonal"
						onclick={() => {
							editingPassword = !editingPassword;
							if (!editingPassword) {
								currentPassword = '';
								newPassword = '';
							}
						}}
						disabled={busy}
					>
						{editingPassword ? 'Cancel' : 'Change'}
					</Button>
				</div>

				{#if editingPassword}
					<form
						onsubmit={changePassword}
						transition:slide={{ duration: 180 }}
						class="bg-surface-container flex flex-col gap-3.5 rounded-2xl p-4"
					>
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div class="flex min-w-0 flex-col gap-1.5">
								<label for="current-password" class="text-on-surface-variant text-xs font-semibold"
									>Current password</label
								>
								<input
									id="current-password"
									type="password"
									autocomplete="current-password"
									bind:value={currentPassword}
									class={inputClass}
								/>
							</div>
							<div class="flex min-w-0 flex-col gap-1.5">
								<label for="new-password" class="text-on-surface-variant text-xs font-semibold"
									>New password</label
								>
								<input
									id="new-password"
									type="password"
									autocomplete="new-password"
									aria-describedby="new-password-requirements"
									bind:value={newPassword}
									class={inputClass}
								/>
							</div>
						</div>

						<p
							id="new-password-requirements"
							class="text-xs {passwordIssue ? 'text-error' : 'text-on-surface-variant'}"
						>
							{passwordIssue ?? '8–128 characters with an uppercase and a lowercase letter.'}
						</p>

						<div class="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
							<label
								class="text-on-surface-variant flex cursor-pointer items-center gap-2.5 text-xs"
							>
								<Checkbox><input type="checkbox" bind:checked={signOutOthers} /></Checkbox>
								<span>Sign out other devices</span>
							</label>
							<Button
								variant="filled"
								type="submit"
								disabled={busy || !currentPassword || !newPassword || !!passwordIssue}
							>
								Update password
							</Button>
						</div>
					</form>
				{/if}
			</div>

			<!-- Passkeys row -->
			<div class="flex flex-col gap-3 px-5 py-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="min-w-0 flex-1">
						<p class="text-on-surface text-sm font-semibold">Passkeys</p>
						<p class="text-on-surface-variant mt-0.5 text-xs">
							Sign in with your fingerprint, face, or device PIN.
						</p>
					</div>
					<Button variant="outlined" onclick={addPasskey} disabled={busy}>Add passkey</Button>
				</div>

				{#if passkeys.length > 0}
					<div class="flex flex-col gap-2">
						{#each passkeys as passkey (passkey.id)}
							<div
								class="bg-surface-container flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5"
							>
								<div class="flex min-w-0 items-center gap-3">
									<div
										class="bg-secondary-container text-on-secondary-container flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="18"
											height="18"
											viewBox="0 0 24 24"
										>
											<path
												fill="currentColor"
												d="M7 14q-.825 0-1.412-.587T5 12t.588-1.412T7 10t1.413.588T9 12t-.587 1.413T7 14m0 4q-2.5 0-4.25-1.75T1 12t1.75-4.25T7 6q1.675 0 3.038.825T12.2 9H21q.825 0 1.413.588T23 11v2q0 .825-.587 1.413T21 15h-1v2q0 .425-.288.713T19 18h-2q-.425 0-.712-.288T16 17v-2h-3.8q-.8 1.35-2.162 2.175T7 18"
											/>
										</svg>
									</div>
									<div class="min-w-0">
										<p class="text-on-surface truncate text-sm font-semibold">
											{passkey.name || 'Passkey'}
										</p>
										<p class="text-on-surface-variant text-xs">
											Added {new Date(passkey.createdAt).toLocaleDateString()}
										</p>
									</div>
								</div>
								<Button variant="text" onclick={() => deletePasskey(passkey.id)} disabled={busy}>
									Remove
								</Button>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-on-surface-variant/80 text-xs">No passkeys added yet.</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Sessions / Sign out -->
	<div
		class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
	>
		<div class="border-outline-variant/40 border-b px-5 py-3.5">
			<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
				Sessions
			</h3>
		</div>
		<div class="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="min-w-0">
				<p class="text-on-surface text-sm font-semibold">Sign out of Maple</p>
				<p class="text-on-surface-variant mt-0.5 text-xs">
					End your current session on this device or revoke access on all devices.
				</p>
			</div>
			<div class="flex flex-col-reverse gap-2 sm:shrink-0 sm:flex-row">
				<Button variant="outlined" onclick={() => leave(true)} disabled={busy}>
					Sign out everywhere
				</Button>
				<Button variant="filled" onclick={() => leave(false)} disabled={busy}>Sign out</Button>
			</div>
		</div>
	</div>
</div>
