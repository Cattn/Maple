<script lang="ts">
	import { Button } from 'm3-svelte';
	import { goto } from '$app/navigation';
	
	let searchValue = $state('');
</script>

<div class="fixed top-0 left-23 right-0 flex h-14 items-center justify-between bg-secondary-container">
    <div class="flex items-center justify-between w-full ml-3 mr-3">
        <Button
            square
            variant="filled"
            iconType="full"
            onclick={() => {
                goto('/');
            }}
        >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M4 19v-9q0-.475.213-.9t.587-.7l6-4.5q.525-.4 1.2-.4t1.2.4l6 4.5q.375.275.588.7T20 10v9q0 .825-.588 1.413T18 21h-3q-.425 0-.712-.288T14 20v-5q0-.425-.288-.712T13 14h-2q-.425 0-.712.288T10 15v5q0 .425-.288.713T9 21H6q-.825 0-1.412-.587T4 19"/></svg>            
        </Button>
        
        <div class="flex items-center justify-center flex-1 mx-4">
            <div class="flex gap-2 w-full justify-center">
                <Button
                        variant="filled"
                        onclick={() => {
                            goto('/');
                        }}
                    >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M9.5 16q-2.725 0-4.612-1.888T3 9.5t1.888-4.612T9.5 3t4.613 1.888T16 9.5q0 1.1-.35 2.075T14.7 13.3l5.6 5.6q.275.275.275.7t-.275.7t-.7.275t-.7-.275l-5.6-5.6q-.75.6-1.725.95T9.5 16m0-2q1.875 0 3.188-1.312T14 9.5t-1.312-3.187T9.5 5T6.313 6.313T5 9.5t1.313 3.188T9.5 14"/></svg>                    
                </Button>

                <input
                    type="text"
                    bind:value={searchValue}
                    placeholder="Search..."
                    class="w-full h-10 text-surface placeholder-surface! pl-4 pr-12 text-sm bg-on-secondary-container rounded-full border border-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 max-w-xl"
                />
                <!-- Future autofill/suggestions container -->
                <!-- <div class="absolute top-full left-0 right-0 bg-surface border border-outline rounded-lg mt-1 shadow-lg z-50">
                    Suggestions will go here
                </div> -->
            </div>
        </div>

        <Button
            square
            variant="filled"
            iconType="full"
            onclick={() => {
                goto('/');
            }}
        >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M10.825 22q-.675 0-1.162-.45t-.588-1.1L8.85 18.8q-.325-.125-.612-.3t-.563-.375l-1.55.65q-.625.275-1.25.05t-.975-.8l-1.175-2.05q-.35-.575-.2-1.225t.675-1.075l1.325-1Q4.5 12.5 4.5 12.337v-.675q0-.162.025-.337l-1.325-1Q2.675 9.9 2.525 9.25t.2-1.225L3.9 5.975q.35-.575.975-.8t1.25.05l1.55.65q.275-.2.575-.375t.6-.3l.225-1.65q.1-.65.588-1.1T10.825 2h2.35q.675 0 1.163.45t.587 1.1l.225 1.65q.325.125.613.3t.562.375l1.55-.65q.625-.275 1.25-.05t.975.8l1.175 2.05q.35.575.2 1.225t-.675 1.075l-1.325 1q.025.175.025.338v.674q0 .163-.05.338l1.325 1q.525.425.675 1.075t-.2 1.225l-1.2 2.05q-.35.575-.975.8t-1.25-.05l-1.5-.65q-.275.2-.575.375t-.6.3l-.225 1.65q-.1.65-.587 1.1t-1.163.45zm1.225-6.5q1.45 0 2.475-1.025T15.55 12t-1.025-2.475T12.05 8.5q-1.475 0-2.488 1.025T8.55 12t1.013 2.475T12.05 15.5"/></svg>
        </Button>
    
    </div>
</div>