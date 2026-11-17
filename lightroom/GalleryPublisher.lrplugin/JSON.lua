--[[
	A small JSON encoder and decoder. Lightroom's SDK has none, and the gallery's API speaks JSON.
	Objects become tables, arrays become lists, and null becomes JSON.null.
]]

local JSON = {}

JSON.null = setmetatable({}, { __tostring = function() return 'null' end })

local escapes = {
	['"'] = '\\"', ['\\'] = '\\\\', ['\b'] = '\\b', ['\f'] = '\\f',
	['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t',
}

local function encodeString(s)
	return '"' .. s:gsub('[%c"\\]', function(c)
		return escapes[c] or string.format('\\u%04x', c:byte())
	end) .. '"'
end

local function isList(t)
	local n = 0
	for k in pairs(t) do
		if type(k) ~= 'number' or k < 1 or k % 1 ~= 0 then return false end
		n = n + 1
	end
	for i = 1, n do
		if t[i] == nil then return false end
	end
	return true, n
end

function JSON.encode(value)
	local kind = type(value)
	if value == nil or value == JSON.null then
		return 'null'
	elseif kind == 'boolean' then
		return value and 'true' or 'false'
	elseif kind == 'number' then
		if value ~= value or value == math.huge or value == -math.huge then return 'null' end
		if value % 1 == 0 and math.abs(value) < 2^53 then return string.format('%d', value) end
		return string.format('%.14g', value)
	elseif kind == 'string' then
		return encodeString(value)
	elseif kind == 'table' then
		local list, n = isList(value)
		local parts = {}
		if list and n > 0 then
			for i = 1, n do parts[i] = JSON.encode(value[i]) end
			return '[' .. table.concat(parts, ',') .. ']'
		end
		for k, v in pairs(value) do
			parts[#parts + 1] = encodeString(tostring(k)) .. ':' .. JSON.encode(v)
		end
		return '{' .. table.concat(parts, ',') .. '}'
	end
	error('Cannot encode a ' .. kind .. ' as JSON')
end

-- Decoding ------------------------------------------------------------------

local decodeValue

local function skip(s, i)
	return s:find('[^ \t\r\n]', i) or #s + 1
end

local function utf8(code)
	if code < 0x80 then return string.char(code) end
	if code < 0x800 then
		return string.char(0xC0 + math.floor(code / 0x40), 0x80 + code % 0x40)
	end
	if code < 0x10000 then
		return string.char(0xE0 + math.floor(code / 0x1000), 0x80 + math.floor(code / 0x40) % 0x40,
			0x80 + code % 0x40)
	end
	return string.char(0xF0 + math.floor(code / 0x40000), 0x80 + math.floor(code / 0x1000) % 0x40,
		0x80 + math.floor(code / 0x40) % 0x40, 0x80 + code % 0x40)
end

local unescapes = { b = '\b', f = '\f', n = '\n', r = '\r', t = '\t', ['"'] = '"', ['\\'] = '\\', ['/'] = '/' }

local function decodeString(s, i)
	local out = {}
	local j = i + 1
	while true do
		local c = s:sub(j, j)
		if c == '' then error('Unfinished string in JSON') end
		if c == '"' then return table.concat(out), j + 1 end
		if c == '\\' then
			local e = s:sub(j + 1, j + 1)
			if e == 'u' then
				local code = tonumber(s:sub(j + 2, j + 5), 16)
				if not code then error('Bad \\u escape in JSON') end
				j = j + 6
				-- A surrogate pair makes one character above U+FFFF.
				if code >= 0xD800 and code <= 0xDBFF and s:sub(j, j + 1) == '\\u' then
					local low = tonumber(s:sub(j + 2, j + 5), 16)
					if low and low >= 0xDC00 and low <= 0xDFFF then
						code = 0x10000 + (code - 0xD800) * 0x400 + (low - 0xDC00)
						j = j + 6
					end
				end
				out[#out + 1] = utf8(code)
			else
				out[#out + 1] = unescapes[e] or e
				j = j + 2
			end
		else
			local stop = s:find('["\\]', j) or #s + 1
			out[#out + 1] = s:sub(j, stop - 1)
			j = stop
		end
	end
end

function decodeValue(s, i)
	i = skip(s, i)
	local c = s:sub(i, i)
	if c == '{' then
		local result = {}
		i = skip(s, i + 1)
		if s:sub(i, i) == '}' then return result, i + 1 end
		while true do
			if s:sub(i, i) ~= '"' then error('Expected a key in JSON') end
			local key
			key, i = decodeString(s, i)
			i = skip(s, i)
			if s:sub(i, i) ~= ':' then error('Expected : in JSON') end
			result[key], i = decodeValue(s, i + 1)
			i = skip(s, i)
			local d = s:sub(i, i)
			if d == '}' then return result, i + 1 end
			if d ~= ',' then error('Expected , or } in JSON') end
			i = skip(s, i + 1)
		end
	elseif c == '[' then
		local result = {}
		i = skip(s, i + 1)
		if s:sub(i, i) == ']' then return result, i + 1 end
		while true do
			result[#result + 1], i = decodeValue(s, i)
			i = skip(s, i)
			local d = s:sub(i, i)
			if d == ']' then return result, i + 1 end
			if d ~= ',' then error('Expected , or ] in JSON') end
			i = i + 1
		end
	elseif c == '"' then
		return decodeString(s, i)
	elseif s:sub(i, i + 3) == 'true' then
		return true, i + 4
	elseif s:sub(i, i + 4) == 'false' then
		return false, i + 5
	elseif s:sub(i, i + 3) == 'null' then
		return JSON.null, i + 4
	else
		local number = s:match('^-?%d+%.?%d*[eE]?[-+]?%d*', i)
		if not number or number == '' then error('Unexpected character in JSON') end
		return tonumber(number), i + #number
	end
end

function JSON.decode(s)
	if type(s) ~= 'string' or s == '' then return nil end
	local value = decodeValue(s, 1)
	return value
end

return JSON
