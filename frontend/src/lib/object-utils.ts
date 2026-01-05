/**
 * Immutable nested object update utilities
 * Used for form settings and other deep state updates
 */

/**
 * Immutably updates a nested property in an object
 * 
 * @example
 * const obj = { user: { name: 'John', age: 30 } };
 * const updated = updateNestedProperty(obj, ['user', 'name'], 'Jane');
 * // { user: { name: 'Jane', age: 30 } }
 */
export function updateNestedProperty<T extends Record<string, any>>(
    obj: T,
    path: string[],
    value: unknown
): T {
    if (path.length === 0) return value as T;

    const [key, ...restPath] = path;

    if (path.length === 1) {
        return {
            ...obj,
            [key]: value,
        };
    }

    return {
        ...obj,
        [key]: updateNestedProperty(obj[key] || {}, restPath, value),
    };
}

/**
 * Merges partial updates into a nested property
 * 
 * @example
 * const obj = { user: { name: 'John', age: 30 } };
 * const updated = mergeNestedProperty(obj, ['user'], { age: 31 });
 * // { user: { name: 'John', age: 31 } }
 */
export function mergeNestedProperty<T extends Record<string, any>>(
    obj: T,
    path: string[],
    updates: Record<string, any>
): T {
    if (path.length === 0) {
        return { ...obj, ...updates };
    }

    const [key, ...restPath] = path;

    return {
        ...obj,
        [key]: restPath.length === 0
            ? { ...(obj[key] || {}), ...updates }
            : mergeNestedProperty(obj[key] || {}, restPath, updates),
    };
}

/**
 * Gets a nested property value safely
 * 
 * @example
 * const obj = { user: { name: 'John' } };
 * getNestedProperty(obj, ['user', 'name']); // 'John'
 * getNestedProperty(obj, ['user', 'email']); // undefined
 */
export function getNestedProperty<T extends Record<string, any>>(
    obj: T,
    path: string[]
): unknown {
    return path.reduce((current, key) => current?.[key], obj);
}

/**
 * Creates an updater function for a specific nested path
 * Useful for form settings with multiple nested sections
 * 
 * @example
 * const updateUser = createNestedUpdater(setState, ['user']);
 * updateUser({ name: 'Jane' }); // Updates state.user with partial updates
 */
export function createNestedUpdater<T extends Record<string, any>>(
    setState: (updater: (prev: T) => T) => void,
    path: string[]
) {
    return (updates: Record<string, any>) => {
        setState((prev: T) => mergeNestedProperty(prev, path, updates));
    };
}
