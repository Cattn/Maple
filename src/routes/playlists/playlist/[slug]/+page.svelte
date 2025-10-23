<script lang="ts">
  let { data }: { data: { playlistId: string } } = $props();
</script>

<h1>Playlist Slug: {data.playlistId}</h1>
