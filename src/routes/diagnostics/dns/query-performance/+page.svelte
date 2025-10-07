<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip';
	import Icon from '$lib/components/global/Icon.svelte';
	import { dnsPerformanceContent } from '$lib/content/dns-performance';
	import '../../../../styles/diagnostics-pages.scss';

	let domain = $state('');
	let recordType = $state('A');
	let loading = $state(false);
	let results = $state<any>(null);
	let error = $state<string | null>(null);
	let selectedExampleIndex = $state<number | null>(null);

	const examples = [
		{ domain: 'google.com', type: 'A', description: 'Google.com A records' },
		{ domain: 'cloudflare.com', type: 'AAAA', description: 'Cloudflare IPv6' },
		{ domain: 'github.com', type: 'MX', description: 'GitHub mail servers' },
		{ domain: 'example.com', type: 'NS', description: 'Example.com nameservers' },
	];

	const recordTypes = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'];

	const isInputValid = $derived.by(() => {
		const trimmed = domain.trim();
		if (!trimmed) return false;
		const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
		return domainPattern.test(trimmed);
	});

	const sortedResults = $derived.by(() => {
		if (!results?.results) return [];
		return [...results.results].sort((a: any, b: any) =>
			a.success && b.success ? a.responseTime - b.responseTime : a.success ? -1 : 1
		);
	});

	function getPerformanceClass(time: number): string {
		if (time < 20) return 'excellent';
		if (time < 50) return 'good';
		if (time < 100) return 'acceptable';
		if (time < 200) return 'slow';
		return 'very-slow';
	}

	function getPerformanceLabel(time: number): string {
		if (time < 20) return 'Excellent';
		if (time < 50) return 'Good';
		if (time < 100) return 'Acceptable';
		if (time < 200) return 'Slow';
		return 'Very Slow';
	}

	async function testPerformance() {
		if (!isInputValid) return;

		loading = true;
		error = null;
		results = null;

		try {
			const response = await fetch('/api/internal/diagnostics/dns-performance', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ domain: domain.trim(), recordType }),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to test DNS performance');
			}

			results = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unexpected error occurred';
		} finally {
			loading = false;
		}
	}

	function loadExample(example: (typeof examples)[0], index: number) {
		domain = example.domain;
		recordType = example.type;
		selectedExampleIndex = index;
		testPerformance();
	}

	function clearExampleSelection() {
		selectedExampleIndex = null;
	}
</script>

<svelte:head>
	<title>DNS Query Performance Comparison | IP Calc</title>
	<meta
		name="description"
		content="Compare DNS resolver speeds across Google, Cloudflare, Quad9, and more. Find the fastest DNS server for your location to improve browsing speed."
	/>
	<meta
		name="keywords"
		content="DNS performance, DNS speed test, DNS resolver comparison, fastest DNS, DNS latency, Cloudflare DNS, Google DNS, Quad9"
	/>
</svelte:head>

<div class="card">
	<header class="card-header">
		<h1>DNS Query Performance Comparison</h1>
		<p>Compare response times across multiple DNS resolvers to find the fastest for your location</p>
	</header>

	<!-- Examples -->
	<div class="card examples-card">
		<details class="examples-details">
			<summary class="examples-summary">
				<Icon name="chevron-right" size="xs" />
				<h4>Quick Examples</h4>
			</summary>
			<div class="examples-grid">
				{#each examples as example, i (i)}
					<button
						class="example-card"
						class:selected={selectedExampleIndex === i}
						onclick={() => loadExample(example, i)}
						use:tooltip={`Test ${example.domain} ${example.type} records`}
					>
						<h5>{example.description}</h5>
						<p>{example.domain} ({example.type})</p>
					</button>
				{/each}
			</div>
		</details>
	</div>

	<!-- Input Form -->
	<div class="card input-card">
		<form
			class="inline-form"
			onsubmit={(e) => {
				e.preventDefault();
				testPerformance();
			}}
		>
			<div class="form-group flex-grow">
				<label for="domain">Domain Name</label>
				<input
					id="domain"
					type="text"
					bind:value={domain}
					oninput={() => {
						selectedExampleIndex = null;
					}}
					placeholder="e.g., google.com"
					disabled={loading}
				/>
			</div>
			<div class="form-group">
				<label for="recordType">Record Type</label>
				<select id="recordType" bind:value={recordType} disabled={loading}>
					{#each recordTypes as type (type)}
						<option value={type}>{type}</option>
					{/each}
				</select>
			</div>
			<button type="submit" disabled={loading || !isInputValid} class="primary submit-btn">
				{#if loading}
					<Icon name="loader" size="sm" animate="spin" />
					Testing...
				{:else}
					<Icon name="zap" size="sm" />
					Test Performance
				{/if}
			</button>
		</form>
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="card error-card">
			<Icon name="alert-triangle" size="md" />
			<div>
				<h4>Error</h4>
				<p>{error}</p>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="card">
			<div class="card-content">
				<div class="loading-state">
					<Icon name="loader" size="lg" animate="spin" />
					<div class="loading-text">
						<h3>Testing DNS Resolvers</h3>
						<p>Querying {recordType} records for {domain}...</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Results -->
	{#if results}
		<div class="card results-card">
			<div class="card-header">
				<h2>Performance Results</h2>
			</div>

			<!-- Statistics Summary -->
			<div class="stats-summary">
				<div class="stat-card fastest">
					<Icon name="zap" size="md" />
					<div class="stat-content">
						<span class="stat-label">Fastest</span>
						<span class="stat-value">{results.statistics.fastest.resolver}</span>
						<span class="stat-detail">{results.statistics.fastest.time}ms</span>
					</div>
				</div>
				<div class="stat-card average">
					<Icon name="activity" size="md" />
					<div class="stat-content">
						<span class="stat-label">Average</span>
						<span class="stat-value">{results.statistics.average}ms</span>
						<span class="stat-detail">Median: {results.statistics.median}ms</span>
					</div>
				</div>
				<div class="stat-card slowest">
					<Icon name="clock" size="md" />
					<div class="stat-content">
						<span class="stat-label">Slowest</span>
						<span class="stat-value">{results.statistics.slowest.resolver}</span>
						<span class="stat-detail">{results.statistics.slowest.time}ms</span>
					</div>
				</div>
				<div class="stat-card success">
					<Icon name="check-circle" size="md" />
					<div class="stat-content">
						<span class="stat-label">Success Rate</span>
						<span class="stat-value">{results.statistics.successRate}%</span>
						<span class="stat-detail"
							>{results.results.filter((r: any) => r.success).length}/{results.results.length}</span
						>
					</div>
				</div>
			</div>

			<!-- Query Info -->
			<div class="query-info">
				<div class="info-item">
					<span class="label">Domain:</span>
					<span class="value">{results.domain}</span>
				</div>
				<div class="info-item">
					<span class="label">Record Type:</span>
					<span class="value">{results.recordType}</span>
				</div>
				<div class="info-item">
					<span class="label">Timestamp:</span>
					<span class="value">{new Date(results.timestamp).toLocaleString()}</span>
				</div>
			</div>

			<!-- Resolver Results -->
			<div class="resolvers-section">
				<h3>Resolver Comparison</h3>
				<div class="resolvers-list">
					{#each sortedResults as result (result.resolver)}
						<div class="resolver-card" class:failed={!result.success}>
							<div class="resolver-header">
								<div class="resolver-info">
									<strong>{result.resolverName}</strong>
									<span class="resolver-ip">{result.resolver}</span>
								</div>
								{#if result.success}
									<div class="performance-badge {getPerformanceClass(result.responseTime)}">
										<span class="time">{result.responseTime}ms</span>
										<span class="label">{getPerformanceLabel(result.responseTime)}</span>
									</div>
								{:else}
									<div class="error-badge">
										<Icon name="x-circle" size="xs" />
										Failed
									</div>
								{/if}
							</div>

							{#if result.success && result.records && result.records.length > 0}
								<details class="records-details">
									<summary>
										<Icon name="chevron-right" size="xs" />
										View {result.records.length} record{result.records.length === 1 ? '' : 's'}
									</summary>
									<div class="records-list">
										{#each result.records as record (record)}
											<code class="record-item">{record}</code>
										{/each}
									</div>
								</details>
							{/if}

							{#if result.error}
								<div class="error-message">
									<Icon name="alert-circle" size="xs" />
									<span>{result.error}</span>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Educational Content -->
<div class="info-sections">
	<div class="card">
		<div class="card-header">
			<h2>{dnsPerformanceContent.sections.whatIsDnsPerformance.title}</h2>
		</div>
		<div class="card-content">
			<p>{dnsPerformanceContent.sections.whatIsDnsPerformance.content}</p>
		</div>
	</div>

	<div class="card">
		<div class="card-header">
			<h2>{dnsPerformanceContent.sections.interpretingResults.title}</h2>
		</div>
		<div class="card-content">
			<p>{dnsPerformanceContent.sections.interpretingResults.content}</p>
			<div class="performance-ranges">
				{#each dnsPerformanceContent.sections.interpretingResults.ranges as range (range.range)}
					<div class="range-item {range.color}">
						<div class="range-header">
							<span class="range-time">{range.range}</span>
							<span class="range-perf">{range.performance}</span>
						</div>
						<p>{range.description}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="card">
		<div class="card-header">
			<h2>{dnsPerformanceContent.sections.publicResolvers.title}</h2>
		</div>
		<div class="card-content">
			<div class="resolvers-grid">
				{#each dnsPerformanceContent.sections.publicResolvers.resolvers as resolver (resolver.name)}
					<div class="resolver-info-card">
						<div class="resolver-info-header">
							<strong>{resolver.name}</strong>
						</div>
						<p class="resolver-desc">{resolver.description}</p>
						<div class="pros-cons">
							<div class="pros">
								<h5>
									<Icon name="check-circle" size="xs" />
									Pros
								</h5>
								<ul>
									{#each resolver.pros as pro (pro)}
										<li>{pro}</li>
									{/each}
								</ul>
							</div>
							<div class="cons">
								<h5>
									<Icon name="x-circle" size="xs" />
									Cons
								</h5>
								<ul>
									{#each resolver.cons as con (con)}
										<li>{con}</li>
									{/each}
								</ul>
							</div>
						</div>
						<div class="best-for">
							<strong>Best for:</strong> {resolver.bestFor}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="card">
		<div class="card-header">
			<h2>{dnsPerformanceContent.sections.optimization.title}</h2>
		</div>
		<div class="card-content">
			<div class="tips-list">
				{#each dnsPerformanceContent.sections.optimization.tips as tip (tip.tip)}
					<div class="tip-item">
						<h4>
							<Icon name="lightbulb" size="xs" />
							{tip.tip}
						</h4>
						<p>{tip.description}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style lang="scss">
	.inline-form {
		display: flex;
		gap: var(--spacing-md);
		align-items: flex-end;
		flex-wrap: wrap;

		.form-group.flex-grow {
			flex: 1;
			min-width: 250px;
			margin: 0;
		}

		.form-group {
			display: flex;
			flex-direction: column;
			gap: var(--spacing-xs);
			margin: 0;

			label {
				font-size: var(--font-size-sm);
				font-weight: 600;
				color: var(--text-secondary);
			}

			select {
				padding: var(--spacing-sm);
				border-radius: var(--radius-sm);
				border: 1px solid var(--border-primary);
				background: var(--bg-primary);
				color: var(--text-primary);
				font-size: var(--font-size-md);
				min-width: 120px;

				&:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}
			}
		}

		.submit-btn {
			white-space: nowrap;
		}
	}

	.stats-summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--spacing-md);
		margin: var(--spacing-lg) 0;
	}

	.stat-card {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		border-left: 3px solid var(--border-primary);

		&.fastest {
			border-left-color: var(--color-success);
			background: linear-gradient(
				135deg,
				color-mix(in srgb, var(--color-success), transparent 95%),
				color-mix(in srgb, var(--color-success), transparent 98%)
			);
		}

		&.slowest {
			border-left-color: var(--color-warning);
			background: linear-gradient(
				135deg,
				color-mix(in srgb, var(--color-warning), transparent 95%),
				color-mix(in srgb, var(--color-warning), transparent 98%)
			);
		}

		.stat-content {
			display: flex;
			flex-direction: column;
			gap: var(--spacing-2xs);

			.stat-label {
				font-size: var(--font-size-xs);
				color: var(--text-tertiary);
				text-transform: uppercase;
				font-weight: 600;
				letter-spacing: 0.5px;
			}

			.stat-value {
				font-size: var(--font-size-lg);
				font-weight: 700;
				color: var(--text-primary);
			}

			.stat-detail {
				font-size: var(--font-size-sm);
				color: var(--text-secondary);
			}
		}
	}

	.query-info {
		display: flex;
		gap: var(--spacing-lg);
		padding: var(--spacing-md);
		background: var(--bg-tertiary);
		border-radius: var(--radius-sm);
		flex-wrap: wrap;

		.info-item {
			display: flex;
			gap: var(--spacing-xs);
			font-size: var(--font-size-sm);

			.label {
				color: var(--text-tertiary);
				font-weight: 600;
			}

			.value {
				color: var(--text-primary);
				font-family: monospace;
			}
		}
	}

	.resolvers-section {
		margin-top: var(--spacing-lg);

		h3 {
			margin: 0 0 var(--spacing-md) 0;
			color: var(--text-primary);
		}
	}

	.resolvers-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.resolver-card {
		padding: var(--spacing-md);
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-primary);

		&.failed {
			opacity: 0.7;
		}

		.resolver-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: var(--spacing-md);

			.resolver-info {
				display: flex;
				flex-direction: column;
				gap: var(--spacing-2xs);

				strong {
					font-size: var(--font-size-md);
					color: var(--text-primary);
				}

				.resolver-ip {
					font-size: var(--font-size-sm);
					color: var(--text-tertiary);
					font-family: monospace;
				}
			}
		}

		.performance-badge {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: var(--spacing-2xs);
			padding: var(--spacing-sm);
			border-radius: var(--radius-sm);
			min-width: 90px;

			.time {
				font-size: var(--font-size-lg);
				font-weight: 700;
				font-family: monospace;
			}

			.label {
				font-size: var(--font-size-xs);
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}

			&.excellent {
				background: var(--color-success);
				color: var(--bg-primary);
			}

			&.good {
				background: color-mix(in srgb, var(--color-success), var(--color-info) 30%);
				color: var(--bg-primary);
			}

			&.acceptable {
				background: var(--color-warning);
				color: var(--bg-primary);
			}

			&.slow {
				background: color-mix(in srgb, var(--color-warning), var(--color-error) 30%);
				color: var(--bg-primary);
			}

			&.very-slow {
				background: var(--color-error);
				color: var(--bg-primary);
			}
		}

		.error-badge {
			display: flex;
			align-items: center;
			gap: var(--spacing-xs);
			padding: var(--spacing-xs) var(--spacing-sm);
			background: var(--color-error);
			color: var(--bg-primary);
			border-radius: var(--radius-sm);
			font-size: var(--font-size-sm);
			font-weight: 600;
		}

		.records-details {
			margin-top: var(--spacing-md);

			summary {
				display: flex;
				align-items: center;
				gap: var(--spacing-xs);
				cursor: pointer;
				color: var(--text-secondary);
				font-size: var(--font-size-sm);
				user-select: none;
				padding: var(--spacing-xs);
				border-radius: var(--radius-sm);
				transition: background var(--transition-fast);

				&:hover {
					background: var(--bg-tertiary);
				}

				:global(.icon) {
					transition: transform var(--transition-fast);
				}
			}

			&[open] summary :global(.icon) {
				transform: rotate(90deg);
			}

			.records-list {
				display: flex;
				flex-direction: column;
				gap: var(--spacing-xs);
				margin-top: var(--spacing-sm);
				padding-left: var(--spacing-md);

				.record-item {
					padding: var(--spacing-xs) var(--spacing-sm);
					background: var(--bg-primary);
					border-radius: var(--radius-sm);
					font-size: var(--font-size-sm);
					color: var(--text-primary);
					word-break: break-all;
				}
			}
		}

		.error-message {
			display: flex;
			align-items: center;
			gap: var(--spacing-xs);
			margin-top: var(--spacing-sm);
			padding: var(--spacing-sm);
			background: color-mix(in srgb, var(--color-error), transparent 95%);
			border-radius: var(--radius-sm);
			color: var(--text-secondary);
			font-size: var(--font-size-sm);
		}
	}

	.info-sections {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
		margin-top: var(--spacing-xl);
		border-top: 1px solid var(--border-primary);
		padding-top: var(--spacing-lg);

		.card {
			width: 100%;
			background: var(--bg-secondary);
		}

		.card-header {
			h2 {
				font-size: var(--font-size-lg);
				margin: 0;
				color: var(--text-primary);
			}
		}

		.card-content {
			p {
				color: var(--text-secondary);
				line-height: 1.6;
				margin-bottom: var(--spacing-md);
			}
		}
	}

	.performance-ranges {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.range-item {
		padding: var(--spacing-md);
		background: var(--bg-primary);
		border-radius: var(--radius-md);
		border-left: 3px solid var(--border-primary);

		&.success {
			border-left-color: var(--color-success);
		}

		&.warning {
			border-left-color: var(--color-warning);
		}

		&.error {
			border-left-color: var(--color-error);
		}

		.range-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: var(--spacing-xs);

			.range-time {
				font-family: monospace;
				font-weight: 700;
				color: var(--text-primary);
			}

			.range-perf {
				font-size: var(--font-size-sm);
				font-weight: 600;
				color: var(--text-secondary);
			}
		}

		p {
			margin: 0;
			font-size: var(--font-size-sm);
			color: var(--text-secondary);
		}
	}

	.resolvers-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: var(--spacing-md);
	}

	.resolver-info-card {
		padding: var(--spacing-md);
		background: var(--bg-primary);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-primary);

		.resolver-info-header {
			margin-bottom: var(--spacing-sm);

			strong {
				font-size: var(--font-size-md);
				color: var(--text-primary);
			}
		}

		.resolver-desc {
			font-size: var(--font-size-sm);
			color: var(--text-secondary);
			margin: 0 0 var(--spacing-md) 0;
		}

		.pros-cons {
			display: flex;
			flex-direction: column;
			gap: var(--spacing-md);
			margin-bottom: var(--spacing-md);

			h5 {
				display: flex;
				align-items: center;
				gap: var(--spacing-xs);
				margin: 0 0 var(--spacing-xs) 0;
				font-size: var(--font-size-sm);
				color: var(--text-primary);
			}

			.pros :global(.icon) {
				color: var(--color-success);
			}

			.cons :global(.icon) {
				color: var(--color-error);
			}

			ul {
				margin: 0;
				padding-left: var(--spacing-lg);
				font-size: var(--font-size-sm);
				color: var(--text-secondary);
				line-height: 1.6;

				li {
					margin-bottom: var(--spacing-2xs);
				}
			}
		}

		.best-for {
			padding-top: var(--spacing-sm);
			border-top: 1px solid var(--border-primary);
			font-size: var(--font-size-sm);
			color: var(--text-secondary);

			strong {
				color: var(--text-primary);
			}
		}
	}

	.tips-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: var(--spacing-md);
	}

	.tip-item {
		padding: var(--spacing-md);
		background: var(--bg-primary);
		border-radius: var(--radius-md);
		border-left: 3px solid var(--color-info);

		h4 {
			display: flex;
			align-items: center;
			gap: var(--spacing-xs);
			margin: 0 0 var(--spacing-sm) 0;
			color: var(--color-primary);
			font-size: var(--font-size-md);

			:global(.icon) {
				color: var(--color-info);
			}
		}

		p {
			margin: 0;
			font-size: var(--font-size-sm);
			color: var(--text-secondary);
			line-height: 1.6;
		}
	}

	@media (max-width: 768px) {
		.inline-form {
			.submit-btn {
				width: 100%;
			}
		}

		.stats-summary {
			grid-template-columns: 1fr;
		}

		.query-info {
			flex-direction: column;
			gap: var(--spacing-sm);
		}

		.resolver-card .resolver-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.resolvers-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
