/*
 * Yuricord, a Discord client mod
 * Copyright (c) 2023 rini
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import "./styles.css";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
const settings = definePluginSettings({
    mode: {
        type: 4 /* OptionType.SELECT */,
        description: "How to display usernames and nicks",
        options: [
            { label: "Username then nickname", value: "user-nick", default: true },
            { label: "Nickname then username", value: "nick-user" },
            { label: "Username only", value: "user" },
        ],
    },
    displayNames: {
        type: 3 /* OptionType.BOOLEAN */,
        description: "Use display names in place of usernames",
        default: false
    },
    inReplies: {
        type: 3 /* OptionType.BOOLEAN */,
        default: false,
        description: "Also apply functionality to reply previews",
    },
});
export default definePlugin({
    name: "ShowMeYourName",
    description: "Display usernames next to nicks, or no nicks at all",
    authors: [Devs.Rini, Devs.TheKodeToad],
    patches: [
        {
            find: '?"@":""',
            replacement: {
                match: /(?<=onContextMenu:\i,children:).*?\)}/,
                replace: "$self.renderUsername(arguments[0])}"
            }
        },
    ],
    settings,
    renderUsername: ErrorBoundary.wrap(({ author, message, isRepliedMessage, withMentionPrefix, userOverride }) => {
        try {
            const user = userOverride ?? message.author;
            let { username } = user;
            if (settings.store.displayNames)
                username = user.globalName || username;
            const { nick } = author;
            const prefix = withMentionPrefix ? "@" : "";
            if (isRepliedMessage && !settings.store.inReplies || username.toLowerCase() === nick.toLowerCase())
                return <>{prefix}{nick}</>;
            if (settings.store.mode === "user-nick")
                return <>{prefix}{username} <span className="vc-smyn-suffix">{nick}</span></>;
            if (settings.store.mode === "nick-user")
                return <>{prefix}{nick} <span className="vc-smyn-suffix">{username}</span></>;
            return <>{prefix}{username}</>;
        }
        catch {
            return <>{author?.nick}</>;
        }
    }, { noop: true }),
});
