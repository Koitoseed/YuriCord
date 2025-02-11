/*
 * Yuricord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
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
import { Margins } from "@utils/margins";
import { wordsFromCamel, wordsToTitle } from "@utils/text";
import { Forms, React, TextInput } from "@webpack/common";
const MAX_SAFE_NUMBER = BigInt(Number.MAX_SAFE_INTEGER);
export function SettingNumericComponent({ option, pluginSettings, definedSettings, id, onChange, onError }) {
    function serialize(value) {
        if (option.type === 2 /* OptionType.BIGINT */)
            return BigInt(value);
        return Number(value);
    }
    const [state, setState] = React.useState(`${pluginSettings[id] ?? option.default ?? 0}`);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        onError(error !== null);
    }, [error]);
    function handleChange(newValue) {
        const isValid = option.isValid?.call(definedSettings, newValue) ?? true;
        setError(null);
        if (typeof isValid === "string")
            setError(isValid);
        else if (!isValid)
            setError("Invalid input provided.");
        if (option.type === 1 /* OptionType.NUMBER */ && BigInt(newValue) >= MAX_SAFE_NUMBER) {
            setState(`${Number.MAX_SAFE_INTEGER}`);
            onChange(serialize(newValue));
        }
        else {
            setState(newValue);
            onChange(serialize(newValue));
        }
    }
    return (<Forms.FormSection>
            <Forms.FormTitle>{wordsToTitle(wordsFromCamel(id))}</Forms.FormTitle>
            <Forms.FormText className={Margins.bottom20} type="description">{option.description}</Forms.FormText>
            <TextInput type="number" pattern="-?[0-9]+" value={state} onChange={handleChange} placeholder={option.placeholder ?? "Enter a number"} disabled={option.disabled?.call(definedSettings) ?? false} {...option.componentProps}/>
            {error && <Forms.FormText style={{ color: "var(--text-danger)" }}>{error}</Forms.FormText>}
        </Forms.FormSection>);
}
