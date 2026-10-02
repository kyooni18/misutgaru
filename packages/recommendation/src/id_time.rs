// SPDX-FileCopyrightText: 2026 Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only

const TIME_2000_MS: i64 = 946_684_800_000;

pub fn parse_misskey_id_time_ms(id: &str, method: &str) -> Option<i64> {
    match method {
        "aid" | "aidx" => parse_radix_i64(id.get(..8)?, 36)?.checked_add(TIME_2000_MS),
        "objectid" => parse_radix_i64(id.get(..8)?, 16)?.checked_mul(1_000),
        "meid" => parse_radix_i64(id.get(..12)?, 16)?.checked_sub(0x8000_0000_0000),
        "meidg" => parse_radix_i64(id.get(1..12)?, 16),
        "ulid" => parse_crockford_time(id.get(..10)?),
        _ => None,
    }
}

fn parse_radix_i64(value: &str, radix: u32) -> Option<i64> {
    i64::from_str_radix(value, radix).ok()
}

fn parse_crockford_time(value: &str) -> Option<i64> {
    const CHARS: &str = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    let mut result = 0_i64;
    for ch in value.chars() {
        let digit = CHARS.find(ch.to_ascii_uppercase())? as i64;
        result = result.checked_mul(32)?.checked_add(digit)?;
    }
    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    trait ToStringRadix {
        fn to_string_radix(self, radix: u32) -> String;
    }

    impl ToStringRadix for i64 {
        fn to_string_radix(self, radix: u32) -> String {
            const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
            if self == 0 {
                return "0".to_owned();
            }
            let mut value = self as u64;
            let mut bytes = Vec::new();
            while value > 0 {
                bytes.push(DIGITS[(value % radix as u64) as usize]);
                value /= radix as u64;
            }
            bytes.reverse();
            String::from_utf8(bytes).expect("ASCII digits")
        }
    }

    #[test]
    fn parses_aidx_time_prefix() {
        let timestamp = 1_788_362_400_000_i64;
        let prefix = (timestamp - TIME_2000_MS).to_string_radix(36);
        let id = format!("{:0>8}abcd0001", prefix);
        assert_eq!(parse_misskey_id_time_ms(&id, "aidx"), Some(timestamp));
    }
}
