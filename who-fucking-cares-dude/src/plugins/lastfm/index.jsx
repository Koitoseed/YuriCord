/*
 * Yuricord, a modification for Discord's desktop app
 * Copyright (c) 2022 Sofia Lima
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { definePluginSettings } from "@api/Settings";
import { Link } from "@components/Link";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ApplicationAssetUtils, FluxDispatcher, Forms } from "@webpack/common";
const applicationId = "1108588077900898414";
const placeholderId = "2a96cbd8b46e442fc41c2b86b821562f";
const logger = new Logger("LastFMRichPresence");
const PresenceStore = findByPropsLazy("getLocalPresence");
async function getApplicationAsset(key) {
    return (await ApplicationAssetUtils.fetchAssetIds(applicationId, [key]))[0];
}
function setActivity(activity) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "LastFM",
    });
}
const settings = definePluginSettings({
    username: {
        description: "last.fm username",
        type: 0 /* OptionType.STRING */,
    },
    apiKey: {
        description: "last.fm api key",
        type: 0 /* OptionType.STRING */,
    },
    shareUsername: {
        description: "show link to last.fm profile",
        type: 3 /* OptionType.BOOLEAN */,
        default: false,
    },
    shareSong: {
        description: "show link to song on last.fm",
        type: 3 /* OptionType.BOOLEAN */,
        default: true,
    },
    hideWithSpotify: {
        description: "hide last.fm presence if spotify is running",
        type: 3 /* OptionType.BOOLEAN */,
        default: true,
    },
    hideWithActivity: {
        description: "Hide Last.fm presence if you have any other presence",
        type: 3 /* OptionType.BOOLEAN */,
        default: false,
    },
    statusName: {
        description: "custom status text",
        type: 0 /* OptionType.STRING */,
        default: "some music",
    },
    nameFormat: {
        description: "Show name of song and artist in status name",
        type: 4 /* OptionType.SELECT */,
        options: [
            {
                label: "Use custom status name",
                value: "status-name" /* NameFormat.StatusName */,
                default: true
            },
            {
                label: "Use format 'artist - song'",
                value: "artist-first" /* NameFormat.ArtistFirst */
            },
            {
                label: "Use format 'song - artist'",
                value: "song-first" /* NameFormat.SongFirst */
            },
            {
                label: "Use artist name only",
                value: "artist" /* NameFormat.ArtistOnly */
            },
            {
                label: "Use song name only",
                value: "song" /* NameFormat.SongOnly */
            },
            {
                label: "Use album name (falls back to custom status text if song has no album)",
                value: "album" /* NameFormat.AlbumName */
            }
        ],
    },
    useListeningStatus: {
        description: 'show "Listening to" status instead of "Playing"',
        type: 3 /* OptionType.BOOLEAN */,
        default: false,
    },
    missingArt: {
        description: "When album or album art is missing",
        type: 4 /* OptionType.SELECT */,
        options: [
            {
                label: "Use large Last.fm logo",
                value: "lastfmLogo",
                default: true
            },
            {
                label: "Use generic placeholder",
                value: "placeholder"
            }
        ],
    },
    showLastFmLogo: {
        description: "show the Last.fm logo by the album cover",
        type: 3 /* OptionType.BOOLEAN */,
        default: true,
    }
});
export default definePlugin({
    name: "LastFMRichPresence",
    description: "Little plugin for Last.fm rich presence",
    authors: [Devs.dzshn, Devs.RuiNtD, Devs.blahajZip, Devs.archeruwu],
    settingsAboutComponent: () => (<>
            <Forms.FormTitle tag="h3">How to get an API key</Forms.FormTitle>
            <Forms.FormText>
                An API key is required to fetch your current track. To get one, you can
                visit <Link href="https://www.last.fm/api/account/create">this page</Link> and
                fill in the following information: <br /> <br />

                Application name: Discord Rich Presence <br />
                Application description: (personal use) <br /> <br />

                And copy the API key (not the shared secret!)
            </Forms.FormText>
        </>),
    settings,
    start() {
        this.updatePresence();
        this.updateInterval = setInterval(() => { this.updatePresence(); }, 16000);
    },
    stop() {
        clearInterval(this.updateInterval);
    },
    async fetchTrackData() {
        if (!settings.store.username || !settings.store.apiKey)
            return null;
        try {
            const params = new URLSearchParams({
                method: "user.getrecenttracks",
                api_key: settings.store.apiKey,
                user: settings.store.username,
                limit: "1",
                format: "json"
            });
            const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
            if (!res.ok)
                throw `${res.status} ${res.statusText}`;
            const json = await res.json();
            if (json.error) {
                logger.error("Error from Last.fm API", `${json.error}: ${json.message}`);
                return null;
            }
            const trackData = json.recenttracks?.track[0];
            if (!trackData?.["@attr"]?.nowplaying)
                return null;
            // why does the json api have xml structure
            return {
                name: trackData.name || "Unknown",
                album: trackData.album["#text"],
                artist: trackData.artist["#text"] || "Unknown",
                url: trackData.url,
                imageUrl: trackData.image?.find((x) => x.size === "large")?.["#text"]
            };
        }
        catch (e) {
            logger.error("Failed to query Last.fm API", e);
            // will clear the rich presence if API fails
            return null;
        }
    },
    async updatePresence() {
        setActivity(await this.getActivity());
    },
    getLargeImage(track) {
        if (track.imageUrl && !track.imageUrl.includes(placeholderId))
            return track.imageUrl;
        if (settings.store.missingArt === "placeholder")
            return "placeholder";
    },
    async getActivity() {
        if (settings.store.hideWithActivity) {
            if (PresenceStore.getActivities().some(a => a.application_id !== applicationId)) {
                return null;
            }
        }
        if (settings.store.hideWithSpotify) {
            if (PresenceStore.getActivities().some(a => a.type === 2 /* ActivityType.LISTENING */ && a.application_id !== applicationId)) {
                // there is already music status because of Spotify or richerCider (probably more)
                return null;
            }
        }
        const trackData = await this.fetchTrackData();
        if (!trackData)
            return null;
        const largeImage = this.getLargeImage(trackData);
        const assets = largeImage ?
            {
                large_image: await getApplicationAsset(largeImage),
                large_text: trackData.album || undefined,
                ...(settings.store.showLastFmLogo && {
                    small_image: await getApplicationAsset("lastfm-small"),
                    small_text: "Last.fm"
                }),
            } : {
            large_image: await getApplicationAsset("lastfm-large"),
            large_text: trackData.album || undefined,
        };
        const buttons = [];
        if (settings.store.shareUsername)
            buttons.push({
                label: "Last.fm Profile",
                url: `https://www.last.fm/user/${settings.store.username}`,
            });
        if (settings.store.shareSong)
            buttons.push({
                label: "View Song",
                url: trackData.url,
            });
        const statusName = (() => {
            switch (settings.store.nameFormat) {
                case "artist-first" /* NameFormat.ArtistFirst */:
                    return trackData.artist + " - " + trackData.name;
                case "song-first" /* NameFormat.SongFirst */:
                    return trackData.name + " - " + trackData.artist;
                case "artist" /* NameFormat.ArtistOnly */:
                    return trackData.artist;
                case "song" /* NameFormat.SongOnly */:
                    return trackData.name;
                case "album" /* NameFormat.AlbumName */:
                    return trackData.album || settings.store.statusName;
                default:
                    return settings.store.statusName;
            }
        })();
        return {
            application_id: applicationId,
            name: statusName,
            details: trackData.name,
            state: trackData.artist,
            assets,
            buttons: buttons.length ? buttons.map(v => v.label) : undefined,
            metadata: {
                button_urls: buttons.map(v => v.url),
            },
            type: settings.store.useListeningStatus ? 2 /* ActivityType.LISTENING */ : 0 /* ActivityType.PLAYING */,
            flags: 1 /* ActivityFlag.INSTANCE */,
        };
    }
});
