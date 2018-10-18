// name: Investment Platform Unit Trust Application for Individual Investors
var objects, hasText = function(id) {
        var text = objects.findBy('id', id).get('text');
        return _.isString(text) && text.length;
    },
    checked = function(id) {
        return !!objects.findBy('id', id).get('check');
    },
    hasTextInFields = function(arr) {
        var result = false;
        for (var i = 0; i < arr.length; i++) {
            result = result || hasText(arr[i]);
        }
        return result;
    },
    validatePage2 = function() {
        objects = pages.get('2.objects'); /* section 3 */
        var bankFilled = hasTextInFields([4, 5, 6, 7, 8]),
            requiredFields = [4, 5, 6, 7, 8];
        if (bankFilled) {
            for (var i = 0; i < requiredFields.length; i++) {
                if (hasText(requiredFields[i])) {
                    setRequiredFields(3, [requiredFields[i]], false);
                    requiredFields.splice(i, 1);
                    --i;
                }
            }
            if (requiredFields.length) {
                setRequiredFields(3, requiredFields, true);
            }
            showRequiredSignature(3, 30, true);
        } else {
            setRequiredFields(3, requiredFields, false);
            showRequiredSignature(3, 30, false);
        } /* section 4 */
        var section4Filled = checked(24) || checked(25) || checked(26) || checked(27) || checked(28) || checked(29) || hasText(9);
        setRequiredFields(3, [24, 25, 26, 27, 28, 29, 9], !section4Filled);
    },
    validatePage3 = function() {
        objects = pages.get('3.objects'); /* section 5 */
        setRequiredFields(4, [34, 35], !checked(34) && !checked(35));
        setRequiredFields(4, [1, 2, 36], checked(35));
    };
validatePage2();
validatePage3();

// name: Investment Platform Unit Trust Application for Legal Entities
var objects, hasText = function(id) {
        var text = objects.findBy('id', id).get('text');
        return _.isString(text) && text.length;
    },
    checked = function(id) {
        return !!objects.findBy('id', id).get('check');
    },
    hasTextInFields = function(arr) {
        var result = false;
        for (var i = 0; i < arr.length; i++) {
            result = result || hasText(arr[i]);
        }
        return result;
    },
    validatePage2 = function() {
        objects = pages.get('1.objects'); /* legal entity details */
        setRequiredFields(2, [35, 36], !checked(35) && !checked(36));
        setRequiredFields(2, [2], checked(35));
        setRequiredFields(2, [37, 38], checked(36) && !checked(37) && !checked(38));
    },
    validatePage3 = function() {
        objects = pages.get('2.objects');
        setRequiredFields(3, [3, 4], !checked(3) && !checked(4));
        setRequiredFields(3, [5, 6, 8, 9, 10, 11, 12, 13, 14, 15], checked(3) && !checked(5) && !checked(6) && !checked(15) && !checked(8) && !checked(9) && !checked(10) && !checked(11) && !checked(12) && !checked(13) && !checked(14));
        setRequiredFields(3, [1, 2], checked(4));
    },
    validatePage4 = function() {
        objects = pages.get('3.objects');
        setRequiredFields(4, [53, 65, 66, 67, 68, 69], !hasText(53) && !checked(65) && !checked(66) && !checked(67) && !checked(68) && !checked(69));
    },
    validatePage5 = function() {
        objects = pages.get('4.objects');
        var bankFilled = hasTextInFields([4, 5, 6, 7, 8]);
        setRequiredFields(5, [4, 5, 6, 7, 8], bankFilled);
        showRequiredSignature(5, 22, bankFilled);
    };
validatePage2();
validatePage3();
validatePage4();
validatePage5();

// name: Unit Trust Additional Contribution
var objects, hasText = function(id) {
        var text = objects.findBy('id', id).get('text');
        return _.isString(text) && text.length;
    },
    checked = function(id) {
        return !!objects.findBy('id', id).get('check');
    },
    hasTextInFields = function(arr) {
        var result = false;
        for (var i = 0; i < arr.length; i++) {
            result = result || hasText(arr[i]);
        }
        return result;
    },
    validatePage3 = function() {
        objects = pages.get('2.objects');
        setRequiredFields(3, [1, 13, 14, 15, 16, 17, 18, 19], !hasText(1) && !checked(13) && !checked(14) && !checked(15) && !checked(16) && !checked(17) && !checked(18) && !checked(19));
        var bankFilled = hasTextInFields([5, 6, 7, 8, 9]);
        setRequiredFields(3, [5, 6, 7, 8, 9], bankFilled);
        showRequiredSignature(3, 34, bankFilled);
    };
validatePage3();

// name: Unit Trust Application for Individual Investors
var objects, hasText = function(id) {
        var text = objects.findBy('id', id).get('text');
        return _.isString(text) && text.length;
    },
    checked = function(id) {
        return !!objects.findBy('id', id).get('check');
    },
    hasTextInFields = function(arr) {
        var result = false;
        for (var i = 0; i < arr.length; i++) {
            result = result || hasText(arr[i]);
        }
        return result;
    },
    validatePage2 = function() {
        objects = pages.get('2.objects');
        var bankFilled = hasTextInFields([4, 5, 6, 7, 8]),
            requiredFields = [4, 5, 6, 7, 8];
        if (bankFilled) {
            for (var i = 0; i < requiredFields.length; i++) {
                if (hasText(requiredFields[i])) {
                    setRequiredFields(3, [requiredFields[i]], false);
                    requiredFields.splice(i, 1);
                    --i;
                }
            }
            if (requiredFields.length) {
                setRequiredFields(3, requiredFields, true);
            }
            showRequiredSignature(3, 30, true);
        } else {
            setRequiredFields(3, requiredFields, false);
            showRequiredSignature(3, 30, false);
        } /* section 4 */
        var section4Filled = checked(24) || checked(25) || checked(26) || checked(27) || checked(28) || checked(29) || hasText(9);
        setRequiredFields(3, [24, 25, 26, 27, 28, 29, 9], !section4Filled);
    },
    validatePage3 = function() {
        objects = pages.get('3.objects');
        setRequiredFields(4, [5, 6], !checked(5) && !checked(6));
        setRequiredFields(4, [1, 2, 7], checked(6));
    };
validatePage2();
validatePage3();

// name: Unit Trust Application for Legal Entities
var objects, hasText = function(id) {
        var text = objects.findBy('id', id).get('text');
        return _.isString(text) && text.length;
    },
    checked = function(id) {
        return !!objects.findBy('id', id).get('check');
    },
    hasTextInFields = function(arr) {
        var result = false;
        for (var i = 0; i < arr.length; i++) {
            result = result || hasText(arr[i]);
        }
        return result;
    },
    validatePage2 = function() {
        objects = pages.get('1.objects'); /* legal entity details */
        setRequiredFields(2, [35, 36], !checked(35) && !checked(36));
        setRequiredFields(2, [2], checked(35));
        setRequiredFields(2, [37, 38], checked(36) && !checked(37) && !checked(38));
    },
    validatePage3 = function() {
        objects = pages.get('2.objects');
        setRequiredFields(3, [3, 4], !checked(3) && !checked(4));
        setRequiredFields(3, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14], checked(3) && !checked(5) && !checked(6) && !checked(7) && !checked(8) && !checked(9) && !checked(10) && !checked(11) && !checked(12) && !checked(13) && !checked(14));
        setRequiredFields(3, [1, 2], checked(4));
    },
    validatePage4 = function() {
        objects = pages.get('3.objects');
        setRequiredFields(4, [39, 41, 42, 43, 44, 45], !hasText(39) && !checked(41) && !checked(42) && !checked(43) && !checked(44) && !checked(45));
    },
    validatePage5 = function() {
        objects = pages.get('4.objects');
        var bankFilled = hasTextInFields([4, 5, 6, 7, 8]);
        setRequiredFields(5, [4, 5, 6, 7, 8], bankFilled);
        showRequiredSignature(5, 22, bankFilled);
    };
validatePage2();
validatePage3();
validatePage4();
validatePage5();

// name: Unit Trust Application for Individual Investors
var objects, hasText = function(id) {
        var text = objects.findBy('id', id).get('text');
        return _.isString(text) && text.length;
    },
    checked = function(id) {
        return !!objects.findBy('id', id).get('check');
    },
    hasTextInFields = function(arr) {
        var result = false;
        for (var i = 0; i < arr.length; i++) {
            result = result || hasText(arr[i]);
        }
        return result;
    },
    validatePage2 = function() {
        objects = pages.get('2.objects');
        var bankFilled = hasTextInFields([4, 5, 6, 7, 8]),
            requiredFields = [4, 5, 6, 7, 8];
        if (bankFilled) {
            for (var i = 0; i < requiredFields.length; i++) {
                if (hasText(requiredFields[i])) {
                    setRequiredFields(3, [requiredFields[i]], false);
                    requiredFields.splice(i, 1);
                    --i;
                }
            }
            if (requiredFields.length) {
                setRequiredFields(3, requiredFields, true);
            }
            showRequiredSignature(3, 30, true);
        } else {
            setRequiredFields(3, requiredFields, false);
            showRequiredSignature(3, 30, false);
        } /* section 4 */
        var section4Filled = checked(24) || checked(25) || checked(26) || checked(27) || checked(28) || checked(29) || hasText(9);
        setRequiredFields(3, [24, 25, 26, 27, 28, 29, 9], !section4Filled);
    },
    validatePage3 = function() {
        objects = pages.get('3.objects');
        setRequiredFields(4, [5, 6], !checked(5) && !checked(6));
        setRequiredFields(4, [1, 2, 7], checked(6));
    };
validatePage2();
validatePage3();

// name: Unit Trust Additional Contribution
var objects, hasText = function(id) {
        var text = objects.findBy('id', id).get('text');
        return _.isString(text) && text.length;
    },
    checked = function(id) {
        return !!objects.findBy('id', id).get('check');
    },
    hasTextInFields = function(arr) {
        var result = false;
        for (var i = 0; i < arr.length; i++) {
            result = result || hasText(arr[i]);
        }
        return result;
    },
    validatePage3 = function() {
        objects = pages.get('2.objects');
        setRequiredFields(3, [1, 13, 14, 15, 16, 17, 18, 19], !hasText(1) && !checked(13) && !checked(14) && !checked(15) && !checked(16) && !checked(17) && !checked(18) && !checked(19));
        var bankFilled = hasTextInFields([5, 6, 7, 8, 9]);
        setRequiredFields(3, [5, 6, 7, 8, 9], bankFilled);
        showRequiredSignature(3, 34, bankFilled);
    };
validatePage3();

// name: Unit Trust Additional Contribution
var objects, hasText = function(id) {
        var text = objects.findBy('id', id).get('text');
        return _.isString(text) && text.length;
    },
    checked = function(id) {
        return !!objects.findBy('id', id).get('check');
    },
    hasTextInFields = function(arr) {
        var result = false;
        for (var i = 0; i < arr.length; i++) {
            result = result || hasText(arr[i]);
        }
        return result;
    },
    validatePage3 = function() {
        objects = pages.get('2.objects');
        setRequiredFields(3, [1, 13, 14, 15, 16, 17, 18, 19], !hasText(1) && !checked(13) && !checked(14) && !checked(15) && !checked(16) && !checked(17) && !checked(18) && !checked(19));
        var bankFilled = hasTextInFields([5, 6, 7, 8, 9]);
        setRequiredFields(3, [5, 6, 7, 8, 9], bankFilled);
        showRequiredSignature(3, 34, bankFilled);
    };
validatePage3();

// name: Unit Trust Additional Contribution
var objects, hasText = function(id) {
        var text = objects.findBy('id', id).get('text');
        return _.isString(text) && text.length;
    },
    checked = function(id) {
        return !!objects.findBy('id', id).get('check');
    },
    hasTextInFields = function(arr) {
        var result = false;
        for (var i = 0; i < arr.length; i++) {
            result = result || hasText(arr[i]);
        }
        return result;
    },
    validatePage3 = function() {
        objects = pages.get('2.objects');
        setRequiredFields(3, [1, 13, 14, 15, 16, 17, 18, 19], !hasText(1) && !checked(13) && !checked(14) && !checked(15) && !checked(16) && !checked(17) && !checked(18) && !checked(19));
        var bankFilled = hasTextInFields([5, 6, 7, 8, 9]);
        setRequiredFields(3, [5, 6, 7, 8, 9], bankFilled);
        showRequiredSignature(3, 34, bankFilled);
    };
validatePage3();

// name: Unit Trust Additional Contribution
var objects, hasText = function(id) {
        var text = objects.findBy('id', id).get('text');
        return _.isString(text) && text.length;
    },
    checked = function(id) {
        return !!objects.findBy('id', id).get('check');
    },
    hasTextInFields = function(arr) {
        var result = false;
        for (var i = 0; i < arr.length; i++) {
            result = result || hasText(arr[i]);
        }
        return result;
    },
    validatePage3 = function() {
        objects = pages.get('2.objects');
        setRequiredFields(3, [1, 13, 14, 15, 16, 17, 18, 19], !hasText(1) && !checked(13) && !checked(14) && !checked(15) && !checked(16) && !checked(17) && !checked(18) && !checked(19));
        var bankFilled = hasTextInFields([5, 6, 7, 8, 9]);
        setRequiredFields(3, [5, 6, 7, 8, 9], bankFilled);
        showRequiredSignature(3, 34, bankFilled);
    };
validatePage3();

// name: Unit Trust Additional Contribution
var objects, hasText = function(id) {
        var text = objects.findBy('id', id).get('text');
        return _.isString(text) && text.length;
    },
    checked = function(id) {
        return !!objects.findBy('id', id).get('check');
    },
    hasTextInFields = function(arr) {
        var result = false;
        for (var i = 0; i < arr.length; i++) {
            result = result || hasText(arr[i]);
        }
        return result;
    },
    validatePage3 = function() {
        objects = pages.get('2.objects');
        setRequiredFields(3, [1, 13, 14, 15, 16, 17, 18, 19], !hasText(1) && !checked(13) && !checked(14) && !checked(15) && !checked(16) && !checked(17) && !checked(18) && !checked(19));
        var bankFilled = hasTextInFields([5, 6, 7, 8, 9]);
        setRequiredFields(3, [5, 6, 7, 8, 9], bankFilled);
        showRequiredSignature(3, 34, bankFilled);
    };
validatePage3();
