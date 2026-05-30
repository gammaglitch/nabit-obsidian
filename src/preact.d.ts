import type { ComponentChildren, JSX as PreactJSX } from 'preact';

declare global {
	namespace JSX {
		type Element = ComponentChildren;
		interface ElementClass extends PreactJSX.ElementClass {}
		interface ElementAttributesProperty
			extends PreactJSX.ElementAttributesProperty {}
		interface ElementChildrenAttribute
			extends PreactJSX.ElementChildrenAttribute {}
		interface IntrinsicAttributes extends PreactJSX.IntrinsicAttributes {}
		interface IntrinsicElements extends PreactJSX.IntrinsicElements {}
		type LibraryManagedAttributes<C, P> =
			PreactJSX.LibraryManagedAttributes<C, P>;
	}
}

export {};
