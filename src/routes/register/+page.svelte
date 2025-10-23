<script lang="ts">
    import { UserManager } from '$lib/api/UserManager';
    let username = '';
    let password = '';
    async function onSubmit(event: SubmitEvent) {
        event.preventDefault();
        await UserManager.register(username, password);
    }
</script>

<form on:submit|preventDefault={onSubmit}>
    <label>
        Username
        <input name="username" type="text" bind:value={username}>
    </label>
    <label>
        Password
        <input name="password" type="password" bind:value={password}>
    </label>
    <button>Register</button>
</form>