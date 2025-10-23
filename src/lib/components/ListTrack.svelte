<script lang="ts">
    import type { Song } from '$lib/types';
    import { playlists } from '$lib/global.svelte';

    const CONTEXT_MENU_EVENT = 'track-context-menu-open';

    let { track, index, trackNo }: { track: Song; index: number; trackNo?: number } = $props();

    let showMenu = $state(false);
    let showPlaylistSubmenu = $state(false);
    let content: HTMLDivElement | undefined = $state(undefined);
    let menuPosition = $state<{ top: number; left: number } | null>(null);
    let hideSubmenuTimeout: number | null = null;

    function portalToBody(node: HTMLElement) {
        if (typeof document !== 'undefined' && node.parentNode !== document.body) {
            document.body.appendChild(node);
        }
        return {
            destroy() {
                if (typeof document !== 'undefined' && node.parentNode === document.body) {
                    document.body.removeChild(node);
                }
            }
        };
    }


    function onRowClick() {}

    function onOpenMenu(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();

        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const menuMinWidth = 192;
        const horizontalPadding = 8;
        const verticalOffset = 4;
        let left = rect.right - menuMinWidth;
        left = Math.max(horizontalPadding, Math.min(left, window.innerWidth - menuMinWidth - horizontalPadding));
        const top = rect.bottom + verticalOffset;
        menuPosition = { top, left };

        window.dispatchEvent(new CustomEvent(CONTEXT_MENU_EVENT, { detail: content }));

        showPlaylistSubmenu = false;
        if (hideSubmenuTimeout) {
            clearTimeout(hideSubmenuTimeout);
            hideSubmenuTimeout = null;
        }
        showMenu = true;
    }

    function onPageClick(e: MouseEvent) {
        if (!content) return;
        const rect = content.getBoundingClientRect();
        const isOutside =
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom;
        if (isOutside) {
            showMenu = false;
            showPlaylistSubmenu = false;
            if (hideSubmenuTimeout) {
                clearTimeout(hideSubmenuTimeout);
                hideSubmenuTimeout = null;
            }
        }
    }

    

    function handleDelete() {
        showMenu = false;
        showPlaylistSubmenu = false;
        if (hideSubmenuTimeout) {
            clearTimeout(hideSubmenuTimeout);
            hideSubmenuTimeout = null;
        }
    }
    
    function handleAddToPlaylist(playlist?: any) {
        showMenu = false;
        showPlaylistSubmenu = false;
        if (hideSubmenuTimeout) {
            clearTimeout(hideSubmenuTimeout);
            hideSubmenuTimeout = null;
        }
    }

    function handlePlaylistHover() {
        if (hideSubmenuTimeout) {
            clearTimeout(hideSubmenuTimeout);
            hideSubmenuTimeout = null;
        }
        showPlaylistSubmenu = true;
    }

    function handlePlaylistLeave() {
        hideSubmenuTimeout = setTimeout(() => {
            showPlaylistSubmenu = false;
            hideSubmenuTimeout = null;
        }, 300);
    }

    function handleOtherMenuOpen(e: CustomEvent) {
        if (e.detail !== content) {
            showMenu = false;
            showPlaylistSubmenu = false;
            if (hideSubmenuTimeout) {
                clearTimeout(hideSubmenuTimeout);
                hideSubmenuTimeout = null;
            }
        }
    }

    if (typeof window !== 'undefined') {
        window.addEventListener(CONTEXT_MENU_EVENT, handleOtherMenuOpen as EventListener);
    }

    $effect(() => {
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(CONTEXT_MENU_EVENT, handleOtherMenuOpen as EventListener);
            }
            if (hideSubmenuTimeout) {
                clearTimeout(hideSubmenuTimeout);
                hideSubmenuTimeout = null;
            }
        };
    });

    function formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
</script>

<svelte:window onclick={onPageClick} />

<li
    class="relative"
    oncontextmenu={(e) => e.preventDefault()}
>
    <div
        class="group flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface-container-high/50 transition-colors duration-150"
        class:pointer-events-none={showMenu}
        onclick={onRowClick}
        role="button"
        tabindex="0"
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onRowClick()}
    >
    <div class="flex items-center gap-3">
        <span class="w-6 text-right text-on-surface-variant">{index}</span>
        <div>
            <p class="text-on-surface">{track.title}</p>
            <p class="text-sm text-on-surface-variant">{track.artist}</p>
        </div>
    </div>
    <div class="flex items-center gap-2">
        {#if trackNo != null}
            <span class="opacity-0 group-hover:opacity-100 transition-opacity duration-150 inline-flex items-center justify-center rounded-full border border-outline-variant bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface-variant">{trackNo}</span>
        {/if}
        <span class="text-sm text-on-surface-variant">{formatDuration(track.duration)}</span>
        <button
            class="opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-full p-1 text-on-surface hover:bg-surface-container-high"
            aria-label="Open menu"
            onclick={onOpenMenu}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 8q-.825 0-1.413-.588T10 6t.588-1.412T12 4t1.413.588T14 6t-.587 1.412T12 8m0 6q-.825 0-1.413-.588T10 12t.588-1.412T12 10t1.413.588T14 12t-.587 1.412T12 14m0 6q-.825 0-1.413-.588T10 18t.588-1.412T12 16t1.413.588T14 18t-.587 1.412T12 20"/></svg>
        </button>
    </div>
    </div>

    {#if showMenu}
        <div
            bind:this={content}
            use:portalToBody
            class="fixed opacity-100"
            style="z-index: 3000;"
            style:top={`${menuPosition?.top ?? 0}px`}
            style:left={`${menuPosition?.left ?? 0}px`}
        >
            <div class="bg-surface border border-outline rounded-xl shadow-2xl py-2 min-w-48">
                <button
                    onclick={handleDelete}
                    class="w-full flex items-center px-4 py-3 text-on-surface hover:bg-surface-container-high transition-colors duration-150 text-left"
                >
                    <svg class="mr-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M7 21q-.825 0-1.412-.587T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21zM17 6H7v13h10zM9 17h2V8H9zm4 0h2V8h-2zM7 6v13z"/></svg>
                    <span class="text-sm font-medium">Delete</span>
                </button>

                <div class="relative">
                    <button
                        onmouseenter={handlePlaylistHover}
                        onmouseleave={handlePlaylistLeave}
                        class="w-full flex items-center justify-between px-4 py-3 text-on-surface hover:bg-surface-container-high transition-colors duration-150 text-left"
                    >
                        <div class="flex items-center">
                            <svg class="mr-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M11 17h2v-4h4v-2h-4V7h-2v4H7v2h4zm1 5q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8"/></svg>
                            <span class="text-sm font-medium">Add to Playlist</span>
                        </div>
                        <svg class="w-4 h-4 transform transition-transform duration-200 {showPlaylistSubmenu ? 'rotate-90' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M8.59 16.58L13.17 12L8.59 7.41L10 6l6 6l-6 6z"/></svg>
                    </button>

                    {#if showPlaylistSubmenu}
                        <div
                            role="menu"
                            tabindex="-1"
                            onmouseenter={handlePlaylistHover}
                            onmouseleave={handlePlaylistLeave}
                            class="absolute top-0 mr-1 bg-surface border border-outline rounded-xl shadow-2xl py-2 min-w-40"
                            style:right={'100%'}
                            style="z-index: 2100;"
                        >
                            {#each playlists() as p}
                                <button
                                    onclick={() => handleAddToPlaylist(p)}
                                    class="w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high transition-colors duration-150"
                                >
                                    {p.name}
                                </button>
                            {/each}
                            <hr class="my-2 border-outline-variant">
                            <button
                                onclick={() => handleAddToPlaylist('new')}
                                class="w-full flex items-center px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high transition-colors duration-150"
                            >
                                <svg class="mr-2 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>
                                Create New Playlist
                            </button>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
    
</li>

