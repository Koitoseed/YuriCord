/*
 * Yuricord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { debounce } from "@shared/debounce";
import { proxyLazy } from "@utils/lazy";
import { useEffect, useState, zustandCreate } from "@webpack/common";
import { getUsersDecorations } from "../api";
import { DECORATION_FETCH_COOLDOWN, SKU_ID } from "../constants";
export const useUsersDecorationsStore = proxyLazy(() => zustandCreate((set, get) => ({
    usersDecorations: new Map(),
    fetchQueue: new Set(),
    bulkFetch: debounce(async () => {
        const { fetchQueue, usersDecorations } = get();
        if (fetchQueue.size === 0)
            return;
        set({ fetchQueue: new Set() });
        const fetchIds = [...fetchQueue];
        const fetchedUsersDecorations = await getUsersDecorations(fetchIds);
        const newUsersDecorations = new Map(usersDecorations);
        const now = new Date();
        for (const fetchId of fetchIds) {
            const newDecoration = fetchedUsersDecorations[fetchId] ?? null;
            newUsersDecorations.set(fetchId, { asset: newDecoration, fetchedAt: now });
        }
        set({ usersDecorations: newUsersDecorations });
    }),
    async fetch(userId, force = false) {
        const { usersDecorations, fetchQueue, bulkFetch } = get();
        const { fetchedAt } = usersDecorations.get(userId) ?? {};
        if (fetchedAt) {
            if (!force && Date.now() - fetchedAt.getTime() < DECORATION_FETCH_COOLDOWN)
                return;
        }
        set({ fetchQueue: new Set(fetchQueue).add(userId) });
        bulkFetch();
    },
    async fetchMany(userIds) {
        if (!userIds.length)
            return;
        const { usersDecorations, fetchQueue, bulkFetch } = get();
        const newFetchQueue = new Set(fetchQueue);
        const now = Date.now();
        for (const userId of userIds) {
            const { fetchedAt } = usersDecorations.get(userId) ?? {};
            if (fetchedAt) {
                if (now - fetchedAt.getTime() < DECORATION_FETCH_COOLDOWN)
                    continue;
            }
            newFetchQueue.add(userId);
        }
        set({ fetchQueue: newFetchQueue });
        bulkFetch();
    },
    get(userId) { return get().usersDecorations.get(userId); },
    getAsset(userId) { return get().usersDecorations.get(userId)?.asset; },
    has(userId) { return get().usersDecorations.has(userId); },
    set(userId, decoration) {
        const { usersDecorations } = get();
        const newUsersDecorations = new Map(usersDecorations);
        newUsersDecorations.set(userId, { asset: decoration, fetchedAt: new Date() });
        set({ usersDecorations: newUsersDecorations });
    }
})));
export function useUserDecorAvatarDecoration(user) {
    try {
        const [decorAvatarDecoration, setDecorAvatarDecoration] = useState(user ? useUsersDecorationsStore.getState().getAsset(user.id) ?? null : null);
        useEffect(() => {
            const destructor = (() => {
                try {
                    return useUsersDecorationsStore.subscribe(state => {
                        if (!user)
                            return;
                        const newDecorAvatarDecoration = state.getAsset(user.id);
                        if (!newDecorAvatarDecoration)
                            return;
                        if (decorAvatarDecoration !== newDecorAvatarDecoration)
                            setDecorAvatarDecoration(newDecorAvatarDecoration);
                    });
                }
                catch {
                    return () => { };
                }
            })();
            try {
                if (user) {
                    const { fetch: fetchUserDecorAvatarDecoration } = useUsersDecorationsStore.getState();
                    fetchUserDecorAvatarDecoration(user.id);
                }
            }
            catch { }
            return destructor;
        }, []);
        return decorAvatarDecoration ? { asset: decorAvatarDecoration, skuId: SKU_ID } : null;
    }
    catch (e) {
        console.error(e);
    }
    return null;
}
