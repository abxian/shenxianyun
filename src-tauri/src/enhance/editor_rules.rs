use serde_yaml_ng::{Mapping, Sequence, Value};
use std::collections::HashSet;

const API_DIRECT: &str = "DOMAIN,api.sxnn.de,DIRECT";

// Run after subscription scripts: homepage edits must survive subscription refreshes.
// Both keys were written by older editors; neither is a Mihomo runtime field.
pub fn apply(config: &mut Mapping, edits: &Mapping) -> Result<(), String> {
    let mut custom = Sequence::new();
    let mut added = HashSet::from([API_DIRECT.to_owned()]);
    for key in ["prepend-rules", "append-rules"] {
        if let Some(value) = edits.get(key) {
            let rules = value.as_sequence().ok_or_else(|| format!("{key} must be a list"))?;
            for rule in rules {
                let raw = rule
                    .as_str()
                    .ok_or_else(|| format!("{key} must contain rule strings"))?;
                let normalized = normalize(raw);
                if added.insert(normalized) {
                    custom.push(rule.clone());
                }
            }
        }
    }
    let existing = match config.get("rules") {
        Some(Value::Sequence(rules)) => rules.clone(),
        None => Sequence::new(),
        Some(_) => return Err("rules must be a list".into()),
    };
    let mut rules = vec![Value::String(API_DIRECT.into())];
    rules.extend(custom);
    rules.extend(
        existing
            .into_iter()
            .filter(|rule| rule.as_str().is_none_or(|raw| !added.contains(&normalize(raw)))),
    );
    config.insert("rules".into(), Value::Sequence(rules));
    config.remove("prepend-rules");
    config.remove("append-rules");
    Ok(())
}

fn normalize(rule: &str) -> String {
    rule.split(',').map(str::trim).collect::<Vec<_>>().join(",")
}

#[cfg(test)]
mod tests {
    use super::*;
    type TestResult<T = ()> = Result<T, Box<dyn std::error::Error>>;

    fn mapping(yaml: &str) -> TestResult<Mapping> {
        Ok(serde_yaml_ng::from_str(yaml)?)
    }

    #[test]
    fn old_editor_files_become_real_rules_after_api_before_subscription() -> TestResult {
        let edits = mapping("prepend-rules: ['DOMAIN-SUFFIX,example.com,DIRECT', 'DOMAIN,api.sxnn.de,DIRECT']\nappend-rules: ['IP-CIDR,192.0.2.0/24,Test']")?;
        let mut config = mapping("rules: ['DOMAIN-SUFFIX,de,DIRECT', 'MATCH,Test']\nprepend-rules: []\nappend-rules: []")?;
        apply(&mut config, &edits)?;
        assert_eq!(config["rules"], mapping("rules: ['DOMAIN,api.sxnn.de,DIRECT', 'DOMAIN-SUFFIX,example.com,DIRECT', 'IP-CIDR,192.0.2.0/24,Test', 'DOMAIN-SUFFIX,de,DIRECT', 'MATCH,Test']")?["rules"]);
        assert!(!config.contains_key("prepend-rules"));
        assert!(!config.contains_key("append-rules"));
        Ok(())
    }

    #[test]
    fn refresh_and_reload_are_idempotent_and_keep_other_fields() -> TestResult {
        let edits = mapping("prepend-rules: ['DOMAIN,example.com,Test', 'DOMAIN,example.com,Test']")?;
        let mut config = mapping("mode: rule\nrules: ['DOMAIN, api.sxnn.de, DIRECT', 'DOMAIN,example.com,Test', 'MATCH,Test']")?;
        apply(&mut config, &edits)?;
        let saved = serde_yaml_ng::to_string(&config)?;
        apply(&mut config, &edits)?;
        assert_eq!(saved, serde_yaml_ng::to_string(&config)?);
        assert_eq!(config["mode"], Value::String("rule".into()));
        let mut refreshed = mapping("rules: ['DOMAIN,updated.example,DIRECT', 'MATCH,Test']")?;
        apply(&mut refreshed, &edits)?;
        assert_eq!(refreshed["rules"], mapping("rules: ['DOMAIN,api.sxnn.de,DIRECT', 'DOMAIN,example.com,Test', 'DOMAIN,updated.example,DIRECT', 'MATCH,Test']")?["rules"]);
        Ok(())
    }

    #[test]
    fn deletion_restores_subscription_order_and_invalid_edits_fail() -> TestResult {
        let mut config = mapping("rules: ['DOMAIN,example.com,Test', 'MATCH,Test']")?;
        apply(&mut config, &Mapping::new())?;
        assert_eq!(config["rules"], mapping("rules: ['DOMAIN,api.sxnn.de,DIRECT', 'DOMAIN,example.com,Test', 'MATCH,Test']")?["rules"]);
        assert!(apply(&mut config, &mapping("prepend-rules: invalid")?).is_err());
        assert!(apply(&mut config, &mapping("prepend-rules: [123]")?).is_err());
        Ok(())
    }
}
