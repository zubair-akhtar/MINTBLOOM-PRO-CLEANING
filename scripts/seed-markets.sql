INSERT INTO "ServiceMarket" (id, name, state, city, "isActive", "createdAt", "updatedAt") VALUES
	('cmtugu23o0000ff5ga9ed9hmp', 'Lubbock', 'TX', 'Lubbock', true, NOW(), NOW()),
	('cmtugu2740001ff5gbndiejx6', 'New Deal', 'TX', 'New Deal', true, NOW(), NOW()),
	('cmtugu2ag0002ff5gjnxoxx1e', 'Wolfforth', 'TX', 'Wolfforth', true, NOW(), NOW()),
	('cmtugu2dq0003ff5gpi3nqx18', 'Plainview', 'TX', 'Plainview', true, NOW(), NOW()),
	('cmtugu2hh0004ff5gezgl04nf', 'Houston', 'TX', 'Houston', true, NOW(), NOW()),
	('cmtugu2l40005ff5g9m2kl0wm', 'Dallas', 'TX', 'Dallas', true, NOW(), NOW()),
	('cmtugu2w20006ff5gyq9afzkd', 'Austin', 'TX', 'Austin', true, NOW(), NOW())
ON CONFLICT DO NOTHING;
