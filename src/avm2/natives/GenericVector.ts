/*
 * Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module Shumway.AVM2.AS {
  /**
   * Check arguments and throw the appropriate errors.
   */
  var checkArguments = true;

  import assert = Shumway.Debug.assert;
  import assertNotImplemented = Shumway.Debug.assertNotImplemented;
  import notImplemented = Shumway.Debug.notImplemented;
  import asCoerceString = Shumway.AVM2.Runtime.asCoerceString;
  import defineNonEnumerableProperty = Shumway.ObjectUtilities.defineNonEnumerableProperty;
  import HasNext2Info = Shumway.AVM2.Runtime.HasNext2Info;
  import throwError = Shumway.AVM2.Runtime.throwError;
  import clamp = Shumway.NumberUtilities.clamp;
  import asCheckVectorGetNumericProperty = Shumway.AVM2.Runtime.asCheckVectorGetNumericProperty;
  import asCheckVectorSetNumericProperty = Shumway.AVM2.Runtime.asCheckVectorSetNumericProperty;

  export class GenericVector extends ASVector<Object> {

    static CASEINSENSITIVE = 1;
    static DESCENDING = 2;
    static UNIQUESORT = 4;
    static RETURNINDEXEDARRAY = 8;
    static NUMERIC = 16;

    public static instanceConstructor: any = GenericVector;
    public static staticNatives: any [] = [GenericVector];
    public static instanceNatives: any [] = [GenericVector.prototype];

    static classInitializer: any = function() {
      var proto: any = GenericVector.prototype;
      defineNonEnumerableProperty(proto, '$Bgjoin', proto.join);
      // Same as join, see VectorImpl.as in Tamarin repository.
      defineNonEnumerableProperty(proto, '$BgtoString', proto.join);
      defineNonEnumerableProperty(proto, '$BgtoLocaleString', proto.toLocaleString);

      defineNonEnumerableProperty(proto, '$Bgpop', proto.pop);
      defineNonEnumerableProperty(proto, '$Bgpush', proto.push);

      defineNonEnumerableProperty(proto, '$Bgreverse', proto.reverse);
      defineNonEnumerableProperty(proto, '$Bgconcat', proto.concat);
      defineNonEnumerableProperty(proto, '$Bgsplice', proto.splice);
      defineNonEnumerableProperty(proto, '$Bgslice', proto.slice);

      defineNonEnumerableProperty(proto, '$Bgshift', proto.shift);
      defineNonEnumerableProperty(proto, '$Bgunshift', proto.unshift);

      defineNonEnumerableProperty(proto, '$BgindexOf', proto.indexOf);
      defineNonEnumerableProperty(proto, '$BglastIndexOf', proto.lastIndexOf);

      defineNonEnumerableProperty(proto, '$BgforEach', proto.forEach);
      defineNonEnumerableProperty(proto, '$Bgmap', proto.map);
      defineNonEnumerableProperty(proto, '$Bgfilter', proto.filter);
      defineNonEnumerableProperty(proto, '$Bgsome', proto.some);
      defineNonEnumerableProperty(proto, '$Bgevery', proto.every);

      defineNonEnumerableProperty(proto, '$Bgsort', proto.sort);
    }

    newThisType(): GenericVector {
      return new GenericVector();
    }

    static defaultCompareFunction(a, b) {
      return String(a).localeCompare(String(b));
    }

    static compare(a, b, options, compareFunction) {
      release || assertNotImplemented (!(options & GenericVector.CASEINSENSITIVE), "CASEINSENSITIVE");
      release || assertNotImplemented (!(options & GenericVector.UNIQUESORT), "UNIQUESORT");
      release || assertNotImplemented (!(options & GenericVector.RETURNINDEXEDARRAY), "RETURNINDEXEDARRAY");
      var result = 0;
      if (!compareFunction) {
        compareFunction = GenericVector.defaultCompareFunction;
      }
      if (options & GenericVector.NUMERIC) {
        a = toNumber(a);
        b = toNumber(b);
        result = a < b ? -1 : (a > b ? 1 : 0);
      } else {
        result = compareFunction(a, b);
      }
      if (options & GenericVector.DESCENDING) {
        result *= -1;
      }
      return result;
    }

    private _fixed: boolean;
    private _buffer: any [];
    private _type: ASClass;
    private _defaultValue: any;

    constructor (length: number /*uint*/ = 0, fixed: boolean = false, type: ASClass = ASObject) {
      false && super();
      length = length >>> 0; fixed = !!fixed;
      this._fixed = !!fixed;
      this._buffer = new Array(length);
      this._type = type;
      this._defaultValue = type ? type.defaultValue : null;
      this._fill(0, length, this._defaultValue);
    }

    /**
     * TODO: Need to really debug this, very tricky.
     */
    public static applyType(type: ASClass): ASClass {
      function parameterizedVectorConstructor(length: number /*uint*/, fixed: boolean) {
        Function.prototype.call.call(GenericVector.instanceConstructor, this, length, fixed, type);
      };

      function parameterizedVectorCallableConstructor(object) {
        if (object instanceof Int32Vector) {
          return object;
        }
        var length = object.asGetProperty(undefined, "length");
        if (length !== undefined) {
          var v = new parameterizedVectorConstructor(length, false);
          for (var i = 0; i < length; i++) {
            v.asSetNumericProperty(i, object.asGetPublicProperty(i));
          }
          return v;
        }
        Shumway.Debug.unexpected();
      }

      var parameterizedVector = <any>parameterizedVectorConstructor;
      parameterizedVector.prototype = GenericVector.prototype;
      parameterizedVector.instanceConstructor = parameterizedVector;
      parameterizedVector.callableConstructor = parameterizedVectorCallableConstructor;
      parameterizedVector.__proto__ = GenericVector;
      return <any>parameterizedVector;
    }

    private _fill(index: number, length: number, value: any) {
      for (var i = 0; i < length; i++) {
        this._buffer[index + i] = value;
      }
    }

    /**
     * Can't use Array.prototype.toString because it doesn't print |null|s the same way as AS3.
     */
    toString() {
      var str = "";
      for (var i = 0; i < this._buffer.length; i++) {
        str += this._buffer[i];
        if (i < this._buffer.length - 1) {
          str += ",";
        }
      }
      return str;
    }

    toLocaleString() {
      var str = "";
      for (var i = 0; i < this._buffer.length; i++) {
        str += this._buffer[i].asCallPublicProperty('toLocaleString');
        if (i < this._buffer.length - 1) {
          str += ",";
        }
      }
      return str;
    }

    sort(sortBehavior?: any) {
      if (arguments.length === 0) {
        return this._buffer.sort();
      }
      if (sortBehavior instanceof Function) {
        return this._buffer.sort(<(a: any, b: any) => number>sortBehavior);
      } else {
        var options = sortBehavior|0;
        release || assertNotImplemented (!(options & Int32Vector.UNIQUESORT), "UNIQUESORT");
        release || assertNotImplemented (!(options & Int32Vector.RETURNINDEXEDARRAY), "RETURNINDEXEDARRAY");
        if (options && GenericVector.NUMERIC) {
          if (options & GenericVector.DESCENDING) {
            return this._buffer.sort((a, b) => asCoerceNumber(b) - asCoerceNumber(a));
          }
          return this._buffer.sort((a, b) => asCoerceNumber(a) - asCoerceNumber(b));
        }
        if (options && GenericVector.CASEINSENSITIVE) {
          if (options & GenericVector.DESCENDING) {
            return this._buffer.sort((a, b) => <any>asCoerceString(b).toLowerCase() -
                                               <any>asCoerceString(a).toLowerCase());
          }
          return this._buffer.sort((a, b) => <any>asCoerceString(a).toLowerCase() -
                                             <any>asCoerceString(b).toLowerCase());
        }
        if (options & GenericVector.DESCENDING) {
          return this._buffer.sort((a, b) => b - a);
        }
        return this._buffer.sort();
      }
    }

    /**
     * Executes a |callback| function with three arguments: element, index, the vector itself as well
     * as passing the |thisObject| as |this| for each of the elements in the vector. If any of the
     * callbacks return |false| the function terminates, otherwise it returns |true|.
     */
    every(callback: Function, thisObject: Object) {
      for (var i = 0; i < this._buffer.length; i++) {
        if (!callback.call(thisObject, this.asGetNumericProperty(i), i, this)) {
          return false;
        }
      }
      return true;
    }

    /**
     * Filters the elements for which the |callback| method returns |true|. The |callback| function
     * is called with three arguments: element, index, the vector itself as well as passing the |thisObject|
     * as |this| for each of the elements in the vector.
     */
    filter(callback, thisObject) {
      var v = new GenericVector(0, false, this._type);
      for (var i = 0; i < this._buffer.length; i++) {
        if (callback.call(thisObject, this.asGetNumericProperty(i), i, this)) {
          v.push(this.asGetNumericProperty(i));
        }
      }
      return v;
    }

    some(callback, thisObject) {
      if (arguments.length !== 2) {
        throwError("ArgumentError", Errors.WrongArgumentCountError);
      } else if (!isFunction(callback)) {
        throwError("ArgumentError", Errors.CheckTypeFailedError);
      }
      for (var i = 0; i < this._buffer.length; i++) {
        if (callback.call(thisObject, this.asGetNumericProperty(i), i, this)) {
          return true;
        }
      }
      return false;
    }

    forEach(callback, thisObject) {
      if (!isFunction(callback)) {
        throwError("ArgumentError", Errors.CheckTypeFailedError);
      }
      for (var i = 0; i < this._buffer.length; i++) {
        callback.call(thisObject, this.asGetNumericProperty(i), i, this);
      }
    }

    join(separator: string = ',') {
      var buffer = this._buffer;
      var limit = this._buffer.length;
      var result = "";
      for (var i = 0; i < limit - 1; i++) {
        result += buffer[i] + separator;
      }
      if (limit > 0) {
        result += buffer[limit - 1];
      }
      return result;
    }

    indexOf(searchElement, fromIndex = 0) {
      return this._buffer.indexOf(searchElement, fromIndex);
    }

    lastIndexOf(searchElement, fromIndex = 0x7fffffff) {
      return this._buffer.lastIndexOf(searchElement, fromIndex);
    }

    map(callback, thisObject) {
      if (!isFunction(callback)) {
        throwError("ArgumentError", Errors.CheckTypeFailedError);
      }
      var v = new GenericVector(0, false, this._type);
      for (var i = 0; i < this._buffer.length; i++) {
        v.push(callback.call(thisObject, this.asGetNumericProperty(i), i, this));
      }
      return v;
    }

    push(arg1?, arg2?, arg3?, arg4?, arg5?, arg6?, arg7?, arg8?/*...rest*/) {
      this._checkFixed();
      for (var i = 0; i < arguments.length; i++) {
        this._buffer.push(this._coerce(arguments[i]));
      }
    }

    pop() {
      this._checkFixed();
      if (this._buffer.length === 0) {
        return undefined;
      }
      return this._buffer.pop();
    }

    concat() {
      // TODO: need to type check the arguments, but isType doesn't exist.
      var buffers = [];
      for (var i = 0; i < arguments.length; i++) {
        buffers.push(this._coerce(arguments[i])._buffer);
      }
      return this._buffer.concat.apply(this._buffer, buffers);
    }

    reverse() {
      this._buffer.reverse();
      return this;
    }

    _coerce(v) {
      if (this._type) {
        return this._type.coerce(v);
      } else if (v === undefined) {
        return null;
      }
      return v;
    }

    shift() {
      this._checkFixed();
      if (this._buffer.length === 0) {
        return undefined;
      }
      return this._buffer.shift();
    }

    unshift() {
      if (!arguments.length) {
        return;
      }
      this._checkFixed();
      for (var i = 0; i < arguments.length; i++) {
        this._buffer.unshift(this._coerce(arguments[i]));
      }
    }

    slice(start = 0, end = 0x7fffffff) {
      var buffer = this._buffer;
      var length = buffer.length;
      var first = Math.min(Math.max(start, 0), length);
      var last = Math.min(Math.max(end, first), length);
      var result = new GenericVector(last - first, this.fixed, this._type);
      result._buffer = buffer.slice(first, last);
      return result;
    }

    splice(start: number, deleteCount_: number /*, ...items */) {
      var buffer = this._buffer;
      var length = buffer.length;
      var first = Math.min(Math.max(start, 0), length);

      var deleteCount = Math.min(Math.max(deleteCount_, 0), length - first);
      var insertCount = arguments.length - 2;
      if (deleteCount !== insertCount) {
        this._checkFixed();
      }
      var items = [first, deleteCount];
      for (var i = 2; i < insertCount + 2; i++) {
        items[i] = this._coerce(arguments[i]);
      }
      var result = new GenericVector(deleteCount, this.fixed, this._type);
      result._buffer = buffer.splice.apply(buffer, items);
      return result;
    }

    get length(): number {
      return this._buffer.length;
    }

    set length(value: number) {
      value = value >>> 0;
      if (value > this._buffer.length) {
        for (var i = this._buffer.length; i < value; i++) {
          this._buffer[i] = this._defaultValue;
        }
      } else {
        this._buffer.length = value;
      }
      release || assert (this._buffer.length === value);
    }

    set fixed(f: boolean) {
      this._fixed = !!f;
    }

    get fixed(): boolean {
      return this._fixed;
    }

    _checkFixed() {
      if (this._fixed) {
        throwError("RangeError", Errors.VectorFixedError);
      }
    }

    asNextName(index: number): any {
      return index - 1;
    }

    asNextValue(index: number): any {
      return this._buffer[index - 1];
    }

    asNextNameIndex(index: number): number {
      var nextNameIndex = index + 1;
      if (nextNameIndex <= this._buffer.length) {
        return nextNameIndex;
      }
      return 0;
    }

    asHasProperty(namespaces, name, flags) {
      if (GenericVector.prototype === this || !isNumeric(name)) {
        return Object.prototype.asHasProperty.call(this, namespaces, name, flags);
      }
      var index = toNumber(name);
      return index >= 0 && index < this._buffer.length;
    }

    asGetNumericProperty(i) {
      checkArguments && asCheckVectorGetNumericProperty(i, this._buffer.length);
      return this._buffer[i];
    }

    asSetNumericProperty(i, v) {
      checkArguments && asCheckVectorSetNumericProperty(i, this._buffer.length, this._fixed);
      this._buffer[i] = this._coerce(v);
    }

    asHasNext2(hasNext2Info: HasNext2Info) {
      hasNext2Info.index = this.asNextNameIndex(hasNext2Info.index)
    }
  }
}
