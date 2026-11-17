--[[
	Talks to the gallery's /api/lightroom endpoints. Every call must run inside an LrTasks task,
	because LrHttp waits for the network. Failures raise an error with a message fit to show.
]]

local LrHttp = import 'LrHttp'
local LrFileUtils = import 'LrFileUtils'
local LrTasks = import 'LrTasks'
local LrDate = import 'LrDate'

local JSON = require 'JSON'

local API = {}

--- Raises a message without Lua's file and line prefix, so it reads well in Lightroom's dialogs.
local function fail(message)
	error(message, 0)
end

-- Matches the browser uploader: each request stays well inside a proxy's time limit.
local CHUNK_SIZE = 8 * 1024 * 1024
local RETRIES = 5

local function baseUrl(settings)
	local url = (settings.serverUrl or ''):gsub('%s', ''):gsub('/+$', '')
	if url == '' then fail('Add your site’s address in the publish service settings.') end
	if not url:match('^https?://') then url = 'https://' .. url end
	return url
end

local function authHeaders(settings, extra)
	local token = (settings.token or ''):gsub('%s', '')
	if token == '' then fail('Add an API token in the publish service settings.') end
	local headers = {
		{ field = 'Authorization', value = 'Bearer ' .. token },
		{ field = 'Accept', value = 'application/json' },
	}
	for _, header in ipairs(extra or {}) do headers[#headers + 1] = header end
	return headers
end

--- Turns an LrHttp reply into data, or raises a readable error.
local function reply(body, headers)
	if not headers or not headers.status then
		local reason = headers and headers.error and headers.error.name or 'no response'
		fail('Couldn’t reach the site (' .. tostring(reason) .. '). Check the address and your connection.')
	end
	local ok, data = pcall(JSON.decode, body)
	if not ok then data = nil end
	if headers.status >= 400 then
		local message = type(data) == 'table' and type(data.message) == 'string' and data.message
		fail(message or ('The site replied with error ' .. headers.status .. '.'))
	end
	return data or {}, headers.status
end

function API.get(settings, path)
	return reply(LrHttp.get(baseUrl(settings) .. path, authHeaders(settings), 60))
end

function API.post(settings, path, body)
	local headers = authHeaders(settings, { { field = 'Content-Type', value = 'application/json' } })
	return reply(LrHttp.post(baseUrl(settings) .. path, JSON.encode(body or {}), headers, 'POST', 60))
end

-- Calls ---------------------------------------------------------------------

function API.ping(settings)
	return API.get(settings, '/api/lightroom')
end

function API.listAlbums(settings)
	return API.get(settings, '/api/lightroom/albums').albums or {}
end

function API.listJobs(settings)
	return API.get(settings, '/api/lightroom/jobs').jobs or {}
end

--- The album, or nil if it has been deleted on the site.
function API.findAlbum(settings, id)
	local body, headers = LrHttp.get(baseUrl(settings) .. '/api/lightroom/albums/' .. tostring(id),
		authHeaders(settings), 60)
	if headers and headers.status == 404 then return nil end
	return reply(body, headers).album
end

function API.createAlbum(settings, fields)
	local body = { action = 'create', title = fields.title, isPublic = fields.isPublic }
	if fields.jobId and fields.jobId ~= 0 then body.jobId = fields.jobId end
	return API.post(settings, '/api/lightroom/albums', body).album
end

function API.renameAlbum(settings, id, title)
	return API.post(settings, '/api/lightroom/albums/' .. tostring(id), { action = 'rename', title = title }).album
end

function API.deletePhotos(settings, ids)
	local list = {}
	for i, id in ipairs(ids) do list[i] = tonumber(id) end
	return API.post(settings, '/api/lightroom/photos', { action = 'delete', ids = list }).deleted or {}
end

-- Uploads -------------------------------------------------------------------

local seeded = false
local function uploadId()
	if not seeded then
		math.randomseed(math.floor((LrDate.currentTime() % 1e6) * 1000))
		seeded = true
	end
	local digits = {}
	for i = 1, 32 do digits[i] = string.format('%x', math.random(0, 15)) end
	return table.concat(digits)
end

local function encodeURIComponent(s)
	return (s:gsub('[^%w%-_%.!~%*\'%(%)]', function(c) return string.format('%%%02X', c:byte()) end))
end

--- Sends a file in 8 MB pieces, carrying on after dropped connections. With `replaceId`, the
--- photo already on the site is replaced in place. Returns { id = …, url = … }.
function API.uploadFile(settings, albumId, path, filename, replaceId)
	local size = LrFileUtils.fileAttributes(path).fileSize
	local file = assert(io.open(path, 'rb'))
	local url = baseUrl(settings) .. '/api/lightroom/albums/' .. tostring(albumId) .. '/photos'
	local id = uploadId()
	local offset, failures = 0, 0

	local ok, result = pcall(function()
		while true do
			file:seek('set', offset)
			local chunk = file:read(CHUNK_SIZE) or ''
			local extra = {
				{ field = 'Content-Type', value = 'application/octet-stream' },
				{ field = 'X-Upload-Id', value = id },
				{ field = 'X-Upload-Offset', value = string.format('%d', offset) },
				{ field = 'X-Upload-Size', value = string.format('%d', size) },
				{ field = 'X-Filename', value = encodeURIComponent(filename) },
			}
			if replaceId and replaceId ~= '' then
				extra[#extra + 1] = { field = 'X-Replace-Photo', value = tostring(replaceId) }
			end
			local body, headers = LrHttp.post(url, chunk, authHeaders(settings, extra), 'POST', 120, #chunk)
			local status = headers and headers.status
			local data = status and select(2, pcall(JSON.decode, body))
			if type(data) ~= 'table' then data = {} end

			if status == 200 and data.photo then
				return data.photo
			elseif status == 200 and data.received then
				offset, failures = data.received, 0
			elseif status == 409 and data.received then
				-- The site has a different amount than we thought: carry on from there.
				offset = data.received
				failures = failures + 1
			elseif not status or status >= 500 then
				failures = failures + 1
				LrTasks.sleep(math.min(2 ^ failures, 30))
			else
				reply(body, headers) -- raises the site's message
			end
			if failures > RETRIES then
				fail('The upload kept failing. Check your connection and publish again.')
			end
		end
	end)
	file:close()
	if not ok then error(result, 0) end
	return result
end

return API
