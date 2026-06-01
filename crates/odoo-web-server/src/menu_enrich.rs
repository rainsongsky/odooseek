//! Enrich Odoo `load_menus` JSON with `resModel` from `ir.actions.act_window`.

use std::collections::{HashMap, HashSet};

use serde_json::Value;

/// Collect act_window action IDs from a flat load_menus dict.
pub fn collect_act_window_action_ids(menus: &Value) -> Vec<i64> {
    let mut ids = HashSet::new();
    let Some(obj) = menus.as_object() else {
        return vec![];
    };
    for entry in obj.values() {
        let Some(action_id) = entry.get("actionID").and_then(|v| v.as_i64()) else {
            continue;
        };
        if action_id <= 0 {
            continue;
        }
        let action_model = entry.get("actionModel").and_then(|v| v.as_str());
        if action_model.is_some()
            && action_model != Some("ir.actions.act_window")
        {
            continue;
        }
        ids.insert(action_id);
    }
    let mut sorted: Vec<i64> = ids.into_iter().collect();
    sorted.sort_unstable();
    sorted
}

/// Attach `resModel` on each menu entry that has a matching action id.
pub fn apply_action_res_models(menus: Value, models: &HashMap<i64, String>) -> Value {
    let Some(mut obj) = menus.as_object().cloned() else {
        return menus;
    };
    for entry in obj.values_mut() {
        let Some(action_id) = entry.get("actionID").and_then(|v| v.as_i64()) else {
            continue;
        };
        let Some(res_model) = models.get(&action_id) else {
            continue;
        };
        if let Some(map) = entry.as_object_mut() {
            map.insert("resModel".into(), Value::String(res_model.clone()));
        }
    }
    Value::Object(obj)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn collect_ids_skips_non_act_window() {
        let menus = json!({
            "1": { "actionID": 10, "actionModel": "ir.actions.act_window" },
            "2": { "actionID": 20, "actionModel": "ir.actions.server" },
            "3": { "actionID": 0 }
        });
        assert_eq!(collect_act_window_action_ids(&menus), vec![10]);
    }

    #[test]
    fn apply_res_model_to_entries() {
        let menus = json!({
            "1": { "actionID": 504, "name": "Contacts" },
            "2": { "actionID": 472, "name": "Employees" }
        });
        let mut map = HashMap::new();
        map.insert(504, "res.partner".into());
        map.insert(472, "hr.employee".into());
        let out = apply_action_res_models(menus, &map);
        assert_eq!(out["1"]["resModel"], "res.partner");
        assert_eq!(out["2"]["resModel"], "hr.employee");
    }
}
